import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { addContactToList, removeContactFromList } from '@/lib/brevo/send'

// Webhook Stripe : runtime Node (crypto pour vérifier la signature), jamais mis en cache.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/* ---------- Helpers de sync Brevo ---------- */
async function moveToPremium(email: string) {
  await Promise.all([
    addContactToList(email, 10),       // NOVAÉ - Premium
    removeContactFromList(email, 9),   // NOVAE - Membres
  ])
  console.log('[webhook] Brevo: moved to Premium →', email)
}

async function moveToMembres(email: string) {
  await Promise.all([
    removeContactFromList(email, 10),  // quitte Premium
    addContactToList(email, 9),         // retour Membres (free)
  ])
  console.log('[webhook] Brevo: back to Membres →', email)
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body, sig, process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('[webhook] Signature invalide:', err.message)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  try {
    switch (event.type) {
      /* ---------- Paiement initial réussi ---------- */
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const email = session.customer_email || session.customer_details?.email || null
        // Priorité à l'id Supabase (robuste), email en repli
        const userId = session.client_reference_id || session.metadata?.supabase_user_id || null

        const patch = {
          subscription_tier: 'premium',
          subscription_status: 'active',
          stripe_customer_id: session.customer as string,
          trial_ends_at: null,
          updated_at: new Date().toISOString(),
        }

        if (userId) {
          await supabase.from('users').update(patch).eq('id', userId)
          console.log('[webhook] Premium activé (par id):', userId)
        } else if (email) {
          await supabase.from('users').update(patch).eq('email', email)
          console.log('[webhook] Premium activé (par email):', email)
        } else {
          console.warn('[webhook] checkout.session.completed sans id ni email')
        }

        if (email) await moveToPremium(email)
        break
      }

      /* ---------- Abonnement mis à jour (réactivation / incident) ---------- */
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        // Dégradation seulement si l'abo est vraiment perdu (pas pendant le dunning past_due)
        const degraded = ['unpaid', 'incomplete_expired'].includes(sub.status)

        const patch: Record<string, any> = {
          subscription_status: sub.status,
          updated_at: new Date().toISOString(),
        }
        if (degraded) patch.subscription_tier = 'expired'
        else if (sub.status === 'active') patch.subscription_tier = 'premium'

        const { data: user } = await supabase
          .from('users')
          .update(patch)
          .eq('stripe_customer_id', sub.customer as string)
          .select('email')
          .maybeSingle()

        console.log('[webhook] Subscription updated →', sub.status, sub.customer)
        if (user?.email) {
          if (degraded) await moveToMembres(user.email)
          else if (sub.status === 'active') await moveToPremium(user.email)
        }
        break
      }

      /* ---------- Abonnement annulé / terminé ---------- */
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const { data: user } = await supabase
          .from('users')
          .update({
            subscription_tier: 'expired',
            subscription_status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', sub.customer as string)
          .select('email')
          .maybeSingle()

        console.log('[webhook] Subscription supprimée →', sub.customer)
        if (user?.email) await moveToMembres(user.email)
        break
      }

      /* ---------- Échec de paiement (dunning) ---------- */
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const { data: user } = await supabase
          .from('users')
          .update({
            subscription_status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', invoice.customer as string)
          .select('email')
          .maybeSingle()

        console.warn('[webhook] Paiement échoué →', invoice.customer, user?.email)
        // 👉 RELANCE BREVO : dès que tu me donnes l'ID de liste "paiement échoué"
        //    (ou un template transactionnel), on déclenche l'email de relance ici.
        break
      }

      default:
        console.log('[webhook] Événement non géré:', event.type)
    }
  } catch (err: any) {
    console.error('[webhook] Erreur de traitement:', event.type, err?.message)
    // 500 → Stripe réessaiera automatiquement l'événement
    return NextResponse.json({ error: 'processing_error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}