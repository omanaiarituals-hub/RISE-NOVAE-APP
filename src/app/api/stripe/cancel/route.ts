import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe'

export const runtime = 'nodejs'

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due', 'unpaid']

async function getUser() {
  const cookieStore = await cookies()
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )
  const { data: { user } } = await client.auth.getUser()
  return user
}

// Retrouve le customer Stripe : d'abord via users.stripe_customer_id, sinon par email
async function resolveCustomerId(userId: string, email: string | null | undefined): Promise<string | null> {
  const stripe = getStripe()
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data } = await admin.from('users').select('stripe_customer_id').eq('id', userId).maybeSingle()
  if (data?.stripe_customer_id) return data.stripe_customer_id as string
  if (email) {
    const cs = await stripe.customers.list({ email, limit: 1 })
    return cs.data[0]?.id ?? null
  }
  return null
}

// GET : statut de l'abonnement (pour afficher le bon bouton)
export async function GET() {
  try {
    const stripe = getStripe()
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const customerId = await resolveCustomerId(user.id, user.email)
    if (!customerId) return NextResponse.json({ hasActive: false })

    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 })
    const sub = subs.data.find(s => ACTIVE_STATUSES.includes(s.status))
    if (!sub) return NextResponse.json({ hasActive: false })

    return NextResponse.json({
      hasActive: true,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      periodEnd: (sub as any).current_period_end ?? null,
    })
  } catch (err: any) {
    console.error('[stripe/cancel] GET error:', err?.message)
    return NextResponse.json({ hasActive: false })
  }
}

// POST : résilie à la fin de la période (la personne garde l'accès jusque-là)
export async function POST() {
  try {
    const stripe = getStripe()
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const customerId = await resolveCustomerId(user.id, user.email)
    if (!customerId) return NextResponse.json({ error: 'no_customer' }, { status: 404 })

    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 })
    const sub = subs.data.find(s => ACTIVE_STATUSES.includes(s.status))
    if (!sub) return NextResponse.json({ error: 'no_active_subscription' }, { status: 404 })

    const updated = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true })

    return NextResponse.json({
      success: true,
      periodEnd: (updated as any).current_period_end ?? null,
    })
  } catch (err: any) {
    console.error('[stripe/cancel] POST error:', err?.message)
    return NextResponse.json({ error: err?.message || 'server_error' }, { status: 500 })
  }
}