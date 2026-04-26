import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
})

export async function POST(req: NextRequest) {
  try {
    const { priceId, email } = await req.json()

    const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  mode: 'subscription',
  customer_email: email,
  line_items: [{ price: priceId, quantity: 1 }],
  subscription_data: {
  trial_period_days: 14,
} as any,

  success_url: `https://novae-by-omanaia.com/subscribe/success`,
  cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscribe`,
})

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}