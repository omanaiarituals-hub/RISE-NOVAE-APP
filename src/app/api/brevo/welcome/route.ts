import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { addBrevoContact } from '@/lib/brevo/send'

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {},
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { pseudo } = await req.json()
    const prenom = (pseudo || user.email.split('@')[0]).trim()

    // Ajout du contact dans la liste NOVAÉ - Membres (#9)
    // → déclenche automatiquement TOUTE la welcome series Brevo :
    //   J0 (1 min) → J+1 Recettes → J+2 Famille → J+3 Programme →
    //   J+4 Agent IA → J+5 Organisation → J+6 Routines → J+7 Communauté →
    //   J+11 Alerte trial → J+14 Fin trial → J+16 Win-back -20%
    const result = await addBrevoContact({
      email: user.email,
      attributes: {
        PRENOM: prenom,
        DATE_INSCRIPTION: new Date().toISOString().split('T')[0],
      },
      listIds: [9],
    })

    if (!result.success) {
      console.error('[brevo welcome] add contact failed:', result.error)
      // On log mais on ne bloque pas l'utilisateur
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[brevo welcome] error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}