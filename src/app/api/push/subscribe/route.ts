import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/supabase/request-auth'

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req)
    if (!user) {
      console.error('[push/subscribe] Auth fail: pas d\'user')
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const { endpoint, keys, userAgent } = await req.json()
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Donnees souscription incompletes' }, { status: 400 })
    }

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

    return NextResponse.json({ success: true, subscription: data })
  } catch (err) {
    console.error('[push/subscribe] Exception:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
