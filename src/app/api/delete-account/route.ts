import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Client admin avec service_role key (côté serveur uniquement)
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

    // 1. Supprimer toutes les données utilisateur
    const tables = [
      'routines',
      'tasks',
      'todo_list',
      'program_progress',
      'meal_plan',
      'community_posts',
      'community_likes',
      'community_comments',
      'challenge_participations',
      'user_badges',
      'family_data',
      'ai_personality_profile',
      'setup_progress',
    ]

    for (const table of tables) {
      await supabaseAdmin.from(table).delete().eq('user_id', userId)
    }

    // 2. Supprimer l'utilisateur dans Supabase Auth (définitif)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (error) {
      console.error('Erreur suppression Auth:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Erreur route delete-account:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}