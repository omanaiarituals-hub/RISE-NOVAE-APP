import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { email, prenom, telephone, listId, ...extra } = await req.json()

    if (!email || !listId) {
      return NextResponse.json({ error: 'Email et listId requis' }, { status: 400 })
    }

    const attributes: Record<string, string> = {}
    if (prenom) attributes.PRENOM = prenom
    if (telephone) attributes.SMS = telephone
    if (extra.APPLIS) attributes.APPLIS = extra.APPLIS
    if (extra.DEFI) attributes.DEFI = extra.DEFI
    if (extra.ENFANTS) attributes.ENFANTS = extra.ENFANTS
    if (extra.SOURCE) attributes.SOURCE = extra.SOURCE

    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY!,
      },
      body: JSON.stringify({
        email,
        attributes,
        listIds: [listId],
        updateEnabled: true,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Brevo error:', err)
      return NextResponse.json({ error: 'Brevo error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Subscribe error:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}