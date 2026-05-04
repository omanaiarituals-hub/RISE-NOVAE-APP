import { NextRequest, NextResponse } from 'next/server'

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

    // Méthode v1 classique — edit tags par external_user_id
    // Plus simple, pas de conflit onesignalId vs externalId
    const res = await fetch(
      `https://onesignal.com/api/v1/apps/${appId}/users/${userId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${restKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tags }),
      }
    )

    const result = await res.json()

    if (!res.ok) {
      console.error('OneSignal tags error:', result)
      return NextResponse.json({ error: result }, { status: res.status })
    }

    return NextResponse.json({ success: true, result })

  } catch (error) {
    console.error('Tags route error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}