// src/app/api/notifications/reply/route.ts
// CORRECTIF SÉCURITÉ (audit 02/07/2026) :
// L'ancienne version était appelable par n'importe qui, sans authentification,
// avec targetUserId / replierPseudo / postPreview libres. Concrètement :
// n'importe qui pouvait envoyer des notifications push arbitraires à
// n'importe quelle utilisatrice de NOVAÉ (spam, contenu choquant, phishing).
//
// Désormais :
//  1. Authentification Bearer obligatoire (même modèle que /api/agent)
//  2. Le client n'envoie plus QUE postId : le destinataire (auteur du post),
//     l'aperçu du contenu et le pseudo de la répondeuse sont relus en base
//     côté serveur. Aucune donnée du push n'est contrôlable par le client.
//  3. On n'auto-notifie pas si l'autrice répond à son propre post.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/push/send'

export async function POST(req: NextRequest) {
  try {
    // ---- 1. Authentification ----
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
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
    if (authError || !user) {
      return NextResponse.json({ error: 'Session invalide' }, { status: 401 })
    }

    // ---- 2. Entrée minimale : uniquement le postId ----
    const { postId } = await req.json()
    if (!postId || typeof postId !== 'string') {
      return NextResponse.json({ error: 'postId manquant' }, { status: 400 })
    }

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // ---- 3. Données dérivées côté serveur (non falsifiables) ----
    const { data: post, error: postError } = await db
      .from('community_posts')
      .select('id, user_id, content')
      .eq('id', postId)
      .maybeSingle()

    if (postError || !post) {
      return NextResponse.json({ error: 'Post introuvable' }, { status: 404 })
    }

    // Pas de notification si on répond à son propre post
    if (post.user_id === user.id) {
      return NextResponse.json({ success: true, sent: 0, skipped: 'self' })
    }

    // Pseudo réel de la répondeuse (fallback : partie locale de l'email)
    const { data: profile } = await db
      .from('ai_personality_profile')
      .select('pseudo')
      .eq('user_id', user.id)
      .maybeSingle()

    const replierPseudo =
      (profile?.pseudo && String(profile.pseudo).trim()) ||
      user.email?.split('@')[0] ||
      'Une membre'

    const rawContent = typeof post.content === 'string' ? post.content : ''
    const preview = rawContent
      ? rawContent.slice(0, 50) + (rawContent.length > 50 ? '...' : '')
      : 'ton message'

    // Lien profond : on amène direct sur le post concerné (la page communauté
    // lit ?post=... pour scroller + ouvrir les réponses). Fallback /community.
    const deepLink = `/community?post=${post.id}`

    // ---- 4. Envoi via Web Push natif (filtré par préférence notif_communaute) ----
    const result = await sendPushToUser(
      post.user_id,
      {
        title: `💬 ${replierPseudo} a répondu`,
        body: `à ton message : "${preview}" ✦`,
        url: deepLink,
        tag: `reply-${post.id}`,
      },
      'notif_communaute' // ne pas envoyer si l'utilisatrice a désactivé cette préf
    )

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
    })
  } catch (error) {
    console.error('[reply] Exception:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
