import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { deleteBrevoContact } from '@/lib/brevo/send'

export async function POST() {
  try {
    // 1. Vérifier l'utilisateur via cookies
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

    const userId = user.id
    const userEmail = user.email

    // 2. Supprimer le contact Brevo (best-effort, non-bloquant)
    if (userEmail) {
      try {
        await deleteBrevoContact(userEmail)
      } catch (err) {
        console.error('[delete-account] Brevo error (non-blocking):', err)
      }
    }

    // 3. Admin client (service role) pour les opérations privilégiées
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 4. Supprimer toutes les données utilisateur via RPC
    const { error: rpcError } = await supabaseAdmin.rpc('delete_user_account', {
      target_user_id: userId,
    })

    if (rpcError) {
      console.error('[delete-account] RPC error:', rpcError)
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    // 5. Supprimer l'utilisateur de auth.users (admin)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authError) {
      console.error('[delete-account] auth delete error:', authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[delete-account] error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}