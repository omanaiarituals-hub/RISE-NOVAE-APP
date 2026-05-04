import { NextRequest, NextResponse } from 'next/server'

// Envoie les tags OneSignal via l'API REST côté serveur
// Contourne le bug SDK JS v16 qui bloque les tags avec erreur 409

export async function POST(req: NextRequest) {
  try {
    const { userId, tags } = await req.json()
    if (!userId || !tags) {
      return NextResponse.json({ error: 'userId et tags requis' }, { status: 400 })
    }

    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    const restKey = process.env.ONESIGNAL_REST_API_KEY

    if (!appId || !restKey) {
      return NextResponse.json({ error: 'OneSignal non configuré' }, { status: 500 })
    }

    // Chercher l'utilisateur OneSignal par External ID (= user_id Supabase)
    const searchRes = await fetch(
      `https://onesignal.com/api/v1/apps/${appId}/users/by/external_id/${userId}`,
      {
        headers: {
          'Authorization': `Basic ${restKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!searchRes.ok) {
      // Utilisateur pas encore dans OneSignal - on ne peut pas envoyer les tags
      return NextResponse.json({ error: 'User not found in OneSignal yet' }, { status: 404 })
    }

    const userData = await searchRes.json()
    const onesignalId = userData?.identity?.onesignal_id

    if (!onesignalId) {
      return NextResponse.json({ error: 'onesignal_id introuvable' }, { status: 404 })
    }

    // Envoyer les tags directement par onesignal_id via PATCH
    const patchRes = await fetch(
      `https://onesignal.com/api/v1/apps/${appId}/users/by/onesignal_id/${onesignalId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Basic ${restKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties: { tags } }),
      }
    )

    if (!patchRes.ok) {
      const err = await patchRes.text()
      return NextResponse.json({ error: err }, { status: 500 })
    }

    return NextResponse.json({ success: true, onesignalId, tags })

  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}