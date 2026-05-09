// src/lib/push/notify.ts
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from './send'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface NotifyParams {
  userId: string
  type: string
  title: string
  body: string
  url?: string
  icon?: string
  preferenceKey?: string
  metadata?: Record<string, any>
}

/**
 * Envoie une notification :
 *   1. Push système (filtré par préférence si fournie)
 *   2. Insert dans la table `notifications` pour la cloche dashboard
 * Si l'user a opt-out (preference = false), on n'envoie PAS et on ne log PAS.
 */
export async function notifyUser(params: NotifyParams) {
  const { userId, type, title, body, url, icon, preferenceKey, metadata } = params

  // Check préférence avant d'envoyer
  if (preferenceKey) {
    const { data: sub } = await supabaseAdmin
      .from('push_subscriptions')
      .select(preferenceKey)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (sub && (sub as any)[preferenceKey] === false) {
      return { sent: 0, failed: 0, skipped: true }
    }
  }

  // 1. Push système
  const pushResult = await sendPushToUser(
    userId,
    { title, body, url, icon, tag: type },
    preferenceKey
  )

  // 2. Log dans notifications (pour la cloche)
  await supabaseAdmin.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    url: url || null,
    icon: icon || null,
    pushed: pushResult.sent > 0,
    metadata: metadata || null,
  })

  return pushResult
}