import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    // Recuperer le token Supabase depuis les cookies pour authentifier l'user
    const authHeader = req.headers.get('authorization')
    const cookieHeader = req.headers.get('cookie') || ''

    // Client Supabase avec les cookies de l'user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { cookie: cookieHeader },
        },
      }
    )

    // Recuperer l'user depuis le token
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    // Parser le body
    const { endpoint, keys, userAgent } = await req.json()
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Donnees souscription incompletes' }, { status: 400 })
    }

    // Client admin pour ecrire dans la table (RLS bypass via service role)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Upsert : insert si pas existant, update si l'endpoint existe deja
    const { data, error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: userAgent || null,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      )
      .select()
      .single()

    if (error) {
      console.error('[push/subscribe] Erreur Supabase:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[push/subscribe] Souscription enregistree pour user:', user.id)
    return NextResponse.json({ success: true, subscription: data })
  } catch (err) {
    console.error('[push/subscribe] Exception:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}