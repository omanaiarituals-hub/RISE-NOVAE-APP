// src/lib/push/send.ts
// Identique à l'original, console.log de debug supprimés (restent les console.error).
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivate = process.env.VAPID_PRIVATE_KEY
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:contact@omanaia.com'

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  icon?: string
  tag?: string
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  preferenceKey?: string
): Promise<{ sent: number; failed: number }> {
  const supabase = getSupabaseAdmin()

  let query = supabase.from('push_subscriptions').select('*').eq('user_id', userId)
  if (preferenceKey) query = query.eq(preferenceKey, true)

  const { data: subs, error } = await query

  if (error) {
    console.error('[push/send] Erreur lecture souscriptions:', error)
    return { sent: 0, failed: 0 }
  }
  if (!subs || subs.length === 0) return { sent: 0, failed: 0 }

  return await sendToSubscriptions(subs, payload)
}

export async function sendPushToAll(
  payload: PushPayload,
  preferenceKey?: string
): Promise<{ sent: number; failed: number }> {
  const supabase = getSupabaseAdmin()

  let query = supabase.from('push_subscriptions').select('*')
  if (preferenceKey) query = query.eq(preferenceKey, true)

  const { data: subs, error } = await query

  if (error) {
    console.error('[push/send] Erreur lecture all souscriptions:', error)
    return { sent: 0, failed: 0 }
  }
  if (!subs || subs.length === 0) return { sent: 0, failed: 0 }

  return await sendToSubscriptions(subs, payload)
}

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
  preferenceKey?: string
): Promise<{ sent: number; failed: number }> {
  const supabase = getSupabaseAdmin()

  let query = supabase.from('push_subscriptions').select('*').in('user_id', userIds)
  if (preferenceKey) query = query.eq(preferenceKey, true)

  const { data: subs, error } = await query

  if (error || !subs || subs.length === 0) return { sent: 0, failed: 0 }

  return await sendToSubscriptions(subs, payload)
}

async function sendToSubscriptions(
  subs: any[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const supabase = getSupabaseAdmin()

  let sent = 0
  let failed = 0
  const expiredEndpoints: string[] = []

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            url: payload.url || '/',
            icon: payload.icon || '/novae-icon.svg',
            tag: payload.tag,
          })
        )
        sent++
        await supabase
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('endpoint', sub.endpoint)
      } catch (err: any) {
        failed++
        if (err.statusCode === 410 || err.statusCode === 404) {
          expiredEndpoints.push(sub.endpoint)
        } else {
          console.error('[push/send] Erreur envoi:', err.statusCode, err.body)
        }
      }
    })
  )

  if (expiredEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
  }

  return { sent, failed }
}