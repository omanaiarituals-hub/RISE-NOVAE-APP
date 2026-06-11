// ============================================================
// NOVAÉ — src/app/api/webhook/route.ts
// Mise à jour 12/06/2026 (audit, fix C3) :
// checkout.session.completed matche désormais par user_id Supabase
// (client_reference_id / metadata.user_id), l'email ne sert plus
// que de solution de secours. Plus aucun risque de cliente facturée
// sans Premium activé à cause d'un email différent.
// Le reste de la logique (subscription.updated / deleted, sync
// Brevo listes 9 et 10) est conservé à l'identique.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { addContactToList, removeContactFromList } from '@/lib/brevo/send'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ---- Helpers de sync Brevo (inchangés) ----
async function moveToPremium(email: string) {
  await Promise.all([
    addContactToList(email, 10), // NOVAÉ - Premium
    removeContactFromList(email, 9), // NOVAE - Membres
  ])
  console.log('[webhook] Brevo: moved to Premium →', email)
}

async function moveToMembres(email: string) {
  await Promise.all([
    removeContactFromList(email, 10), // quitte Premium
    addContactToList(email, 9), // retour Membres (free)
  ])
  console.log('[webhook] Brevo: back to Membres →', email)
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session

      const userId =
        session.client_reference_id || session.metadata?.user_id || null
      const email =
        session.customer_email || session.customer_details?.email || null

      const updatePayload = {
        subscription_tier: 'premium',
        stripe_customer_id: session.customer as string,
        trial_ends_at: null,
        updated_at: new Date().toISOString(),
      }

      let activatedEmail: string | null = null

      // ---- Priorité 1 : matching fiable par ID Supabase ----
      if (userId) {
        const { data: user, error } = await supabase
          .from('users')
          .update(updatePayload)
          .eq('id', userId)
          .select('email')
          .single()

        if (!error && user) {
          activatedEmail = user.email
          console.log('[webhook] Premium activated by user_id:', userId)
        }
      }

      // ---- Secours : matching par email (anciennes sessions) ----
      if (!activatedEmail && email) {
        const { data: user, error } = await supabase
          .from('users')
          .update(updatePayload)
          .eq('email', email)
          .select('email')
          .single()

        if (!error && user) {
          activatedEmail = user.email
          console.log('[webhook] Premium activated by email (fallback):', email)
        }
      }

      if (activatedEmail) {
        await moveToPremium(activatedEmail)
      } else {
        // Aucun compte trouvé : on loggue fort pour intervention manuelle
        console.error(
          '[webhook] ALERTE: paiement reçu mais aucun compte matché.',
          'user_id:', userId, '| email:', email,
          '| session:', session.id
        )
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription

      // Si suspendu ou en retard de paiement → expired
      if (
        sub.status === 'past_due' ||
        sub.status === 'unpaid' ||
        sub.status === 'incomplete_expired'
      ) {
        const { data: user } = await supabase
          .from('users')
          .update({
            subscription_tier: 'expired',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', sub.customer as string)
          .select('email')
          .single()
        console.log(
          '[webhook] Subscription degraded for customer:',
          sub.customer
        )
        if (user?.email) await moveToMembres(user.email)
      }
      // Si réactivé après paiement → premium
      else if (sub.status === 'active') {
        const { data: user } = await supabase
          .from('users')
          .update({
            subscription_tier: 'premium',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', sub.customer as string)
          .select('email')
          .single()
        console.log(
          '[webhook] Subscription reactivated for customer:',
          sub.customer
        )
        if (user?.email) await moveToPremium(user.email)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const { data: user } = await supabase
        .from('users')
        .update({
          subscription_tier: 'expired',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', sub.customer as string)
        .select('email')
        .single()
      console.log(
        '[webhook] Subscription cancelled for customer:',
        sub.customer
      )
      if (user?.email) await moveToMembres(user.email)
      break
    }
  }

  return NextResponse.json({ received: true })
}