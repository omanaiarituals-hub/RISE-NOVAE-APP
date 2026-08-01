import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// Réinitialise TOUT ce qui est propre à Nova pour l'utilisatrice connectée :
//   - sa mémoire apprise (nova_memories)
//   - son historique de conversation (nova_conversations + messages)
//   - ses messages proactifs en attente (nova_pending_messages)
// N'EFFACE AUCUNE donnée des modules (documents, famille, tâches, notes, etc.).
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuration Supabase incomplète.' }, { status: 500 })
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const userId = user.id

    // Ordre : messages avant conversations (clé étrangère), puis le reste.
    await supabaseAdmin.from('nova_conversation_messages').delete().eq('user_id', userId)
    await supabaseAdmin.from('nova_conversations').delete().eq('user_id', userId)
    await supabaseAdmin.from('nova_pending_messages').delete().eq('user_id', userId)
    await supabaseAdmin.from('nova_memories').delete().eq('user_id', userId)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[api/nova/memory/reset] error', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Réinitialisation impossible.' },
      { status: 500 }
    )
  }
}
