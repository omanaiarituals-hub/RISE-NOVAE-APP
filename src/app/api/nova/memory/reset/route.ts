import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// Réinitialise TOUT ce qui est propre à Nova pour l'utilisatrice connectée :
//   - sa mémoire apprise (nova_memories)
//   - son historique de conversation (nova_conversations + messages)
//   - ses messages proactifs en attente (nova_pending_messages)
// N'EFFACE AUCUNE donnée des modules (documents, famille, tâches, notes, etc.).
export async function POST() {
  try {
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

    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

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
