import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { sendBrevoEmail, addBrevoContact } from '@/lib/brevo/send'

const ADMIN_EMAIL = 'nesserinesediri@gmail.com'

export async function POST(req: Request) {
  // Lecture optionnelle du templateId depuis le body
  let customTemplateId: number | undefined
  try {
    const body = await req.json()
    if (body && typeof body.templateId === 'number') customTemplateId = body.templateId
  } catch {}
        try {
    // Vérifier admin
    const cookieStore = await cookies()
    const userClient = createServerClient(
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
    } = await userClient.auth.getUser()

    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 })
    }

       // Récupère le templateId depuis le body (par défaut 6 = J0 BIENVENUE)
    let templateId = 6
    try {
      const body = await req.json()
      if (body.templateId) templateId = Number(body.templateId)
    } catch {}

    // Admin client pour récupérer toutes les données
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Récupère tous les profils avec pseudo
    const { data: profiles } = await supabaseAdmin
      .from('ai_personality_profile')
      .select('user_id, pseudo')

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ message: 'Aucun profil trouvé', total: 0 })
    }

    // Récupère les emails depuis auth.users
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers()
    const emailById = new Map(authData.users.map(u => [u.id, u.email]))

    const results: any[] = []

    for (const profile of profiles) {
      const email = emailById.get(profile.user_id)
      if (!email) {
        results.push({ user_id: profile.user_id, status: 'no_email_found' })
        continue
      }

      const prenom = (profile.pseudo || email.split('@')[0]).trim()

      try {
        // Ajoute le contact Brevo
        await addBrevoContact({
          email,
          attributes: {
            PRENOM: prenom,
            DATE_INSCRIPTION: new Date().toISOString().split('T')[0],
          },
        })

       // Envoie le mail (templateId 6 = J0 par défaut, ou custom si passé)
        const result = await sendBrevoEmail({
          to: { email, name: prenom },
          templateId: customTemplateId || 6,
          params: { prenom },
        })

        results.push({
          email,
          prenom,
          status: result.success ? 'sent' : 'failed',
          messageId: result.messageId,
          error: result.error,
        })
      } catch (err) {
        results.push({
          email,
          prenom,
          status: 'error',
          error: String(err),
        })
      }

      // Petit délai entre chaque envoi pour éviter rate limit
      await new Promise(r => setTimeout(r, 200))
    }

    const sent = results.filter(r => r.status === 'sent').length
    const failed = results.length - sent

    return NextResponse.json({
      total: results.length,
      sent,
      failed,
      results,
    })
  } catch (err) {
    console.error('[admin send-welcome-batch] error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}