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

// Helpers de sync Brevo
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
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body, sig, process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const email = session.customer_email || session.customer_details?.email
      if (email) {
        await supabase
          .from('users')
          .update({
            subscription_tier: 'premium',
            stripe_customer_id: session.customer as string,
            trial_ends_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('email', email)
        console.log('[webhook] Premium activated for:', email)
        await moveToPremium(email)
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      // Si suspendu ou en retard de paiement → expired
      if (sub.status === 'past_due' || sub.status === 'unpaid' || sub.status === 'incomplete_expired') {
        const { data: user } = await supabase
          .from('users')
          .update({
            subscription_tier: 'expired',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', sub.customer as string)
          .select('email')
          .single()
        console.log('[webhook] Subscription degraded for customer:', sub.customer)
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
        console.log('[webhook] Subscription reactivated for customer:', sub.customer)
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
      console.log('[webhook] Subscription cancelled for customer:', sub.customer)
      if (user?.email) await moveToMembres(user.email)
      break
    }
  }

  return NextResponse.json({ received: true })
}