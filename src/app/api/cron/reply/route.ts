import { NextRequest, NextResponse } from 'next/server'

// ── Route appelée instantanément quand quelqu'un répond à un commentaire ──────
// Appelée depuis community/page.tsx après insertion du commentaire en BDD
// Envoie une notif push immédiate à l'auteur du post original

export async function POST(req: NextRequest) {
  try {
    const { targetUserId, replierPseudo, postId, postPreview } = await req.json()

    if (!targetUserId || !replierPseudo) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    // Ne pas notifier si c'est l'utilisateur qui répond à son propre post
    // (géré côté client avant d'appeler cette route)

    const preview = postPreview
      ? postPreview.slice(0, 50) + (postPreview.length > 50 ? '...' : '')
      : 'ton message'

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
        filters: [
          { field: 'tag', key: 'user_id', relation: '=', value: targetUserId },
          { operator: 'AND' },
          // Respecter la préférence notif_communaute
          { field: 'tag', key: 'notif_communaute', relation: '!=', value: 'false' },
        ],
        headings: { fr: `💬 ${replierPseudo} a répondu` },
        contents: { fr: `à ton message : "${preview}" ✦` },
        url: `https://app.novae-by-omanaia.com/community`,
        // Notif prioritaire — envoi immédiat
        priority: 10,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ error: err }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}