// src/app/api/stripe/portal/route.ts
// CORRECTIF CRITIQUE (audit 04/07/2026, seconde passe) :
// L'ancienne version acceptait un email libre dans le body quand aucun token
// n'etait fourni. Concretement : n'importe qui sur Internet pouvait POST
// { "email": "cliente@exemple.com" } et recevoir une URL de portail Stripe
// valide pour cette cliente (annulation de son abonnement, changement de
// carte, acces a ses factures avec nom et adresse).
//
// Desormais :
//  1. Authentification Bearer OBLIGATOIRE. Pas de token valide = 401.
//  2. Le customer Stripe est resolu d'abord via users.stripe_customer_id
//     (fiable), puis en secours par l'email VERIFIE du compte connecte.
//     Aucune donnee du body n'est utilisee.
//
// Verifie : le seul appelant (src/app/subscription/page.tsx ligne 99) envoie
// deja le header Authorization et aucun body. Zero regression attendue.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe()

    // ---- 1. Authentification obligatoire ----
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    )
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token)

    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Session invalide' }, { status: 401 })
    }

    // ---- 2. Resolution du customer Stripe (jamais depuis le body) ----
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    let customerId: string | null = null

    const { data: userRow } = await admin
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    if (userRow?.stripe_customer_id) {
      customerId = userRow.stripe_customer_id as string
    } else {
      // Secours : email verifie du compte connecte (jamais celui du client)
      const customers = await stripe.customers.list({ email: user.email, limit: 1 })
      customerId = customers.data[0]?.id ?? null
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'Aucun abonnement trouve pour ce compte' },
        { status: 404 }
      )
    }

    // ---- 3. Creation de la session du portail ----
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: 'https://app.novae-by-omanaia.com/subscription',
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('[stripe/portal] Error:', error?.message || error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}