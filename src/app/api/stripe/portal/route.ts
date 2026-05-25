import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
})

// Ouvre le portail client Stripe : l'utilisatrice peut annuler, mettre en pause,
// changer de carte, voir ses factures. Tout est heberge par Stripe (securise, PCI).
// On ne stocke pas le stripe_customer_id => on retrouve le client par son email.
export async function POST(req: NextRequest) {
  try {
    let email: string | null = null

    // 1) Methode securisee : on identifie l'utilisatrice via son token Supabase
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (token) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data } = await supabase.auth.getUser(token)
        email = data.user?.email ?? null
      } catch (e) {
        console.error('[stripe/portal] getUser error:', e)
      }
    }

    // 2) Fallback : email fourni dans le body (compat avec l'appel actuel de la page)
    if (!email) {
      try {
        const body = await req.json()
        if (body?.email) email = String(body.email)
      } catch {}
    }

    if (!email) {
      return NextResponse.json({ error: 'Utilisateur non identifie' }, { status: 401 })
    }

    // 3) Retrouver le client Stripe par email
    const customers = await stripe.customers.list({ email, limit: 1 })
    const customer = customers.data[0]
    if (!customer) {
      return NextResponse.json(
        { error: 'Aucun abonnement trouve pour cet email' },
        { status: 404 }
      )
    }

    // 4) Creer la session du portail de gestion
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: 'https://app.novae-by-omanaia.com/subscription',
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('[stripe/portal] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}