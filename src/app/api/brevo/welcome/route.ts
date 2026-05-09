import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sendBrevoEmail, addBrevoContact } from '@/lib/brevo/send'

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

    // 1. Ajout contact Brevo (pour les automatisations futures)
    await addBrevoContact({
      email: user.email,
      attributes: {
        PRENOM: prenom,
        DATE_INSCRIPTION: new Date().toISOString().split('T')[0],
      },
    })

    // 2. Envoi du J0 (template #6)
    const result = await sendBrevoEmail({
to: { email: user.email, name: prenom || user.email },    
  templateId: 6,
params: { prenom: prenom || '' },    })

    if (!result.success) {
      return NextResponse.json({ error: result.error, status: result.status }, { status: 500 })
    }

    return NextResponse.json({ success: true, messageId: result.messageId })
  } catch (err) {
    console.error('[brevo welcome] error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}