import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
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
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignoré : la session sera rafraîchie au prochain request via le middleware
            }
          },
        },
      }
    )

    // Lecture user via cookies SSR (parse correctement le format Supabase)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('[push/subscribe] Auth fail:', authError?.message || 'pas d\'user')
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    // Parse body
    const { endpoint, keys, userAgent } = await req.json()
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Donnees souscription incompletes' }, { status: 400 })
    }

    // Client admin pour bypass RLS sur l'écriture (service role)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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