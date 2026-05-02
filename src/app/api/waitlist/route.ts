import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { prenom, email, tel } = await req.json()

    if (!prenom || !email) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
    }

    const telFormate = tel ? '+33' + tel.replace(/^0/, '').replace(/\s/g, '') : undefined

    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY!,
      },
      body: JSON.stringify({
        email,
        attributes: { PRENOM: prenom, ...(telFormate ? { SMS: telFormate } : {}) },
        listIds: [8], // ← vérifie l'ID de ta liste d'attente dans Brevo
        updateEnabled: true,
      }),
    })

    if (!res.ok && res.status !== 204) {
      const err = await res.json()
      console.error('Brevo error:', err)
      return NextResponse.json({ error: 'Erreur Brevo' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Waitlist error:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}