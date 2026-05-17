import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
      const email = session.customer_email
      if (email) {
        await supabase
          .from('users')
          .update({
            subscription_tier: 'premium',           // ← lu par permissions.ts
            stripe_customer_id: session.customer as string,
            trial_ends_at: null,                    // ← reset trial
            updated_at: new Date().toISOString(),
          })
          .eq('email', email)
        console.log('[webhook] Premium activated for:', email)
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      // Si suspendu ou en retard de paiement → expired
      if (sub.status === 'past_due' || sub.status === 'unpaid' || sub.status === 'incomplete_expired') {
        await supabase
          .from('users')
          .update({
            subscription_tier: 'expired',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', sub.customer as string)
        console.log('[webhook] Subscription degraded for customer:', sub.customer)
      }
      // Si réactivé après paiement → premium
      else if (sub.status === 'active') {
        await supabase
          .from('users')
          .update({
            subscription_tier: 'premium',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', sub.customer as string)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await supabase
        .from('users')
        .update({
          subscription_tier: 'expired',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', sub.customer as string)
      console.log('[webhook] Subscription cancelled for customer:', sub.customer)
      break
    }
    }
    
  return NextResponse.json({ received: true })
}