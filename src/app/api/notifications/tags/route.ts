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
      return NextResponse.json({ error: 'OneSignal non configure' }, { status: 500 })
    }

    // Endpoint v2 : identifier le user par External ID Supabase
    const url = `https://api.onesignal.com/apps/${appId}/users/by/external_id/${userId}`

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Key ${restKey}`,
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify({
        properties: { tags }
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      console.error('[API tags] OneSignal erreur:', result, 'status:', res.status)
      return NextResponse.json({ error: result, status: res.status }, { status: res.status })
    }

    console.log('[API tags] Tags mis a jour pour user:', userId)
    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('[API tags] Exception:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}