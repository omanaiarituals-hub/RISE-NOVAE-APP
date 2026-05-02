import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId manquant' }, { status: 400 })
    }

    // Supprimer via fonction SQL SECURITY DEFINER
    const { error } = await supabaseAdmin.rpc('delete_user_account', {
      target_user_id: userId
    })

    if (error) {
      console.error('Erreur suppression:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Erreur route delete-account:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}