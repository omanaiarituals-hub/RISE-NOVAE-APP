// src/app/api/track-landing/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/track-landing
 *
 * Reçoit un événement de tracking depuis la landing (page_view, cta_click, scroll_depth)
 * et l'insère dans public.landing_events côté serveur.
 *
 * Avantages vs appel direct Supabase depuis le navigateur :
 * - Pas de problème CORS
 * - Pas d'interception par le service worker PWA
 * - L'anon key n'a plus à être exposée dans le HTML
 * - On peut filtrer / valider les events ici si besoin
 */
export async function POST(request: NextRequest) {
  try {
    // ─── 1) Parse le body (accepte JSON ET text/plain qui contient du JSON) ───
    let body: any
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      body = await request.json()
    } else {
      const text = await request.text()
      try {
        body = JSON.parse(text)
      } catch {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
      }
    }

    // ─── 2) Validation minimale ───
    if (!body || typeof body !== 'object' || !body.event_type) {
      return NextResponse.json({ error: 'event_type required' }, { status: 400 })
    }

    const allowedTypes = ['page_view', 'cta_click', 'scroll_depth']
    if (!allowedTypes.includes(body.event_type)) {
      return NextResponse.json({ error: 'invalid event_type' }, { status: 400 })
    }

    // ─── 3) Supabase client serveur ───
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Configuration manquante' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    })

    // ─── 4) Truncate les valeurs pour pas exploser la table ───
    const truncate = (v: any, max: number) => {
      if (typeof v !== 'string') return v ?? null
      return v.length > max ? v.slice(0, max) : v
    }

    const { error } = await supabase.from('landing_events').insert({
      event_type:   body.event_type,
      event_label:  truncate(body.event_label, 60),
      page:         truncate(body.page, 200),
      referrer:     truncate(body.referrer, 300),
      session_id:   truncate(body.session_id, 60),
      utm_source:   truncate(body.utm_source, 60),
      utm_medium:   truncate(body.utm_medium, 60),
      utm_campaign: truncate(body.utm_campaign, 60),
    })

    if (error) {
      // On log côté serveur mais on renvoie 204 quand même
      // (pour pas faire échouer le tracking côté navigateur)
      console.error('[track-landing] Supabase error:', error.message)
    }

    // Réponse vide légère, le navigateur n'attend rien de toute façon
    return new NextResponse(null, { status: 204 })
  } catch (err: any) {
    console.error('[track-landing] error:', err?.message || err)
    return new NextResponse(null, { status: 204 })
  }
}