'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

declare global {
  interface Window { OneSignalDeferred: any[] }
}

const NOTIF_KEYS = [
  'notif_routines',
  'notif_conflits',
  'notif_communaute',
  'notif_anniversaires',
  'notif_inactivite',
  'notif_bilan',
]

export default function OneSignalInit() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    if (!appId) return

    window.OneSignalDeferred = window.OneSignalDeferred || []
    const script = document.createElement('script')
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
    script.defer = true
    document.head.appendChild(script)

    script.onload = () => {
      window.OneSignalDeferred.push(async function(OneSignal: any) {
        // 1. Init OneSignal
        await OneSignal.init({
          appId,
          notifyButton: { enable: false },
          promptOptions: {
            slidedown: {
              prompts: [{
                type: 'push',
                autoPrompt: false,
                text: {
                  actionMessage: "NOVAÉ aimerait t'envoyer ton bilan hebdo et tes rappels.",
                  acceptButton: 'Oui, activer',
                  cancelButton: 'Plus tard',
                }
              }]
            }
          }
        })

        // 2. Recuperer le user Supabase
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 3. Login OneSignal avec l'External ID
        await OneSignal.login(user.id)

        // 4. Tags - tout dans OneSignalDeferred, seule API qui marche en v16
        const tags: Record<string, string> = {
          user_id: user.id,
          email: user.email || '',
        }

        NOTIF_KEYS.forEach(key => {
          if (localStorage.getItem(key) === null) {
            localStorage.setItem(key, 'true')
          }
          tags[key] = localStorage.getItem(key) !== 'false' ? 'true' : 'false'
        })

        for (const [key, value] of Object.entries(tags)) {
          try {
            await OneSignal.User.addTag(key, value)
          } catch (e) {}
        }

        // 5. Demander la permission si pas encore accordee
        try {
          if (Notification.permission === 'default') {
            setTimeout(async () => {
              try { await OneSignal.Slidedown.promptPush() } catch {}
            }, 3000)
          }
        } catch {}
      })
    }
  }, [])

  return null
}