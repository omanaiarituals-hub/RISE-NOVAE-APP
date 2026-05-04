import { NextRequest, NextResponse } from 'next/server'

// ── Route appelée depuis le client pour synchroniser les préférences
// avec les tags OneSignal.
// OneSignal filtre les envois sur les tags côté serveur.
// Si notif_routines = 'false' → le cron ne l'envoie pas.
// Appeler cette route à chaque toggle dans Settings + au login.

export async function POST(req: NextRequest) {
  try {
    const { playerId, preferences } = await req.json()
    // preferences = { notif_routines: true, notif_conflits: false, ... }

    if (!playerId) {
      return NextResponse.json({ error: 'playerId requis' }, { status: 400 })
    }

    // Construire les tags OneSignal
    const tags: Record<string, string> = {}
    for (const [key, value] of Object.entries(preferences)) {
      tags[key] = value ? 'true' : 'false'
    }

    // Mettre à jour les tags du player OneSignal via l'API
    const response = await fetch(
      `https://onesignal.com/api/v1/players/${playerId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
        },
        body: JSON.stringify({
          app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
          tags,
        }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ error: err }, { status: 500 })
    }

    return NextResponse.json({ success: true, tags })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}