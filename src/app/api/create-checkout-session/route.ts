import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
})

export async function POST(req: NextRequest) {
  try {
    const { priceId, email } = await req.json()

    if (!priceId || !email) {
      return NextResponse.json(
        { error: 'priceId et email requis' },
        { status: 400 }
      )
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      // PAS de trial_period_days ici — le trial est géré côté Supabase (userInit.ts)
      success_url: 'https://app.novae-by-omanaia.com/subscribe/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://app.novae-by-omanaia.com/subscribe',
      allow_promotion_codes: true,
      metadata: {
        email,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('[checkout] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}