import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUser } from '@/lib/push/send'

// Route appelee instantanement quand quelqu'un repond a un commentaire
// Appelee depuis community/page.tsx apres insertion du commentaire en BDD
// Envoie une notif push immediate a l'auteur du post original
export async function POST(req: NextRequest) {
  try {
    const { targetUserId, replierPseudo, postId, postPreview } = await req.json()

    if (!targetUserId || !replierPseudo) {
      return NextResponse.json({ error: 'Parametres manquants' }, { status: 400 })
    }

    const preview = postPreview
      ? postPreview.slice(0, 50) + (postPreview.length > 50 ? '...' : '')
      : 'ton message'

    // Lien profond : on amene direct sur le post concerne (la page communaute
    // lit ?post=... pour scroller + ouvrir les reponses). Fallback /community.
    const deepLink = postId ? `/community?post=${postId}` : '/community'

    // Envoi via Web Push natif (filtre par preference notif_communaute)
    const result = await sendPushToUser(
      targetUserId,
      {
        title: `💬 ${replierPseudo} a répondu`,
        body: `à ton message : "${preview}" ✦`,
        url: deepLink,
        tag: `reply-${postId}`,
      },
      'notif_communaute' // ne pas envoyer si l user a desactive cette pref
    )

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
    })
  } catch (error) {
    console.error('[reply] Exception:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}