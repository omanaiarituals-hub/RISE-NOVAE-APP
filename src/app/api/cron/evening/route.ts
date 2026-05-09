// src/app/api/cron/evening/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/push/notify'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const results: string[] = []

  try {
    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('user_id')
    const uniqueUserIds = Array.from(new Set((subs || []).map(s => s.user_id)))

    // ─── 1. ROUTINE SOIR + RAPPEL TODO ─────────────────────────────────
    for (const userId of uniqueUserIds) {
      await notifyUser({
        userId,
        type: 'evening_brief',
        title: '🌙 Pose-toi un instant',
        body: 'Prends ton rituel du soir, et pense à planifier les tâches de demain dans ta todolist pour ne rien oublier ✦',
        url: '/routines',
        preferenceKey: 'notif_routines',
      })
      results.push(`Brief soir → ${userId}`)
    }

    // ─── 2. RÉSUMÉ COMMUNAUTÉ DU JOUR ──────────────────────────────────
    const oneDayAgo = new Date(now); oneDayAgo.setUTCDate(oneDayAgo.getUTCDate() - 1)
    const { count: newPosts } = await supabaseAdmin
      .from('community_posts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo.toISOString())

    if (newPosts && newPosts > 0) {
      for (const userId of uniqueUserIds) {
        await notifyUser({
          userId,
          type: 'community_summary',
          title: '💬 La communauté s\'anime',
          body: `${newPosts} nouveau${newPosts > 1 ? 'x' : ''} message${newPosts > 1 ? 's' : ''} aujourd'hui dans la communauté ✦`,
          url: '/community',
          preferenceKey: 'notif_communaute',
        })
      }
      results.push(`Communauté: ${newPosts} posts → ${uniqueUserIds.length} users`)
    }

    return NextResponse.json({ success: true, executed: results, count: results.length })
  } catch (error) {
    console.error('[cron/evening] Error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}