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

    // Charger le SDK OneSignal
    window.OneSignalDeferred = window.OneSignalDeferred || []
    const script = document.createElement('script')
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
    script.defer = true
    document.head.appendChild(script)

    script.onload = () => {
      window.OneSignalDeferred.push(async function(OneSignal: any) {
        // Init OneSignal - sans login() qui cause le conflit 409
        await OneSignal.init({
          appId,
          notifyButton: { enable: false },
          promptOptions: {
            slidedown: {
              prompts: [{
                type: 'push',
                autoPrompt: false,
                text: {
                  actionMessage: "NOVAÉ aimerait t'envoyer des rappels et ton bilan hebdo.",
                  acceptButton: 'Oui, activer',
                  cancelButton: 'Plus tard',
                }
              }]
            }
          }
        })

        // Demander la permission si pas encore accordée
        try {
          if (Notification.permission === 'default') {
            setTimeout(async () => {
              try { await OneSignal.Slidedown.promptPush() } catch {}
            }, 3000)
          }
        } catch {}
      })
    }

    // Envoyer les tags via l'API REST après que le user soit connu
    // On attend que Supabase soit prêt
    const sendTagsViaAPI = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Construire les tags
        const tags: Record<string, string> = {
          user_id: user.id,
          email: user.email || '',
        }
        NOTIF_KEYS.forEach(key => {
          if (localStorage.getItem(key) === null) localStorage.setItem(key, 'true')
          tags[key] = localStorage.getItem(key) !== 'false' ? 'true' : 'false'
        })

        // Envoyer via notre API route (qui utilise la REST API OneSignal côté serveur)
        await fetch('/api/notifications/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, tags }),
        })
      } catch (err) {
        console.error('Tags error:', err)
      }
    }

    // Attendre un peu que Supabase soit initialisé
    setTimeout(sendTagsViaAPI, 2000)

  }, [])

  return null
}