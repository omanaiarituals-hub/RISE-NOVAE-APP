// ============================================================
// NOVAÉ — src/app/api/create-checkout-session/route.ts
// Mise à jour 12/06/2026 (audit, fix C4) :
// 1. Authentification obligatoire (Bearer token Supabase),
//    sur le même modèle que /api/stripe/portal
// 2. priceId validé contre une liste blanche (2 prix officiels)
// 3. client_reference_id = user.id Supabase → le webhook matche
//    désormais par ID et non plus par email (fix C3)
//
// ⚠️ Variables à ajouter dans Vercel (Settings → Environment Variables) :
//    STRIPE_PRICE_ID_PREMIUM    = price_xxx (prix 7,90 €)
//    STRIPE_PRICE_ID_PIONNIERE  = price_xxx (prix Pionnière 6,32 €)
//    (les IDs sont dans le dashboard Stripe → Catalogue de produits)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
})

// Liste blanche des prix autorisés
const ALLOWED_PRICE_IDS = [
  process.env.STRIPE_PRICE_ID_PREMIUM,
  process.env.STRIPE_PRICE_ID_PIONNIERE,
].filter(Boolean) as string[]

export async function POST(req: NextRequest) {
  try {
    // ---- 1. Authentification (même modèle que stripe/portal) ----
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.slice(7)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ---- 2. Validation du prix demandé ----
    const { priceId } = await req.json()

    if (!priceId) {
      return NextResponse.json({ error: 'priceId requis' }, { status: 400 })
    }

    if (!ALLOWED_PRICE_IDS.includes(priceId)) {
      console.warn('[checkout] priceId refusé:', priceId, 'user:', user.id)
      return NextResponse.json({ error: 'Prix non autorisé' }, { status: 400 })
    }

    // ---- 3. Création de la session checkout ----
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email, // email vérifié du compte, pas celui du client
      client_reference_id: user.id, // ← clé du fix C3 : le webhook matche par ID
      line_items: [{ price: priceId, quantity: 1 }],
      // PAS de trial_period_days ici — le trial est géré côté Supabase (userInit.ts)
      success_url:
        'https://app.novae-by-omanaia.com/subscribe/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://app.novae-by-omanaia.com/subscribe',
      allow_promotion_codes: true,
      metadata: {
        user_id: user.id,
        email: user.email,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('[checkout] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}