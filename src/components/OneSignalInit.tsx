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
        await OneSignal.init({
          appId,
          notifyButton: { enable: false },
          promptOptions: {
            slidedown: {
              prompts: [{
                type: 'push',
                autoPrompt: false,
                text: {
                  actionMessage: 'NOVAÉ aimerait t\'envoyer ton bilan hebdo et tes rappels.',
                  acceptButton: 'Oui, activer',
                  cancelButton: 'Plus tard',
                }
              }]
            }
          }
        })

        // Récupérer le user Supabase
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 1. Associer l'External ID = user_id Supabase
        await OneSignal.login(user.id)

        // 2. Tags de base — user_id + email
        await OneSignal.User.addTag('user_id', user.id)
        await OneSignal.User.addTag('email', user.email || '')

        // 3. Synchroniser les préférences de notifications depuis localStorage
        // Si une clé n'existe pas encore → on la crée à 'true' par défaut
        const prefTags: Record<string, string> = {}
        NOTIF_KEYS.forEach(key => {
          const stored = localStorage.getItem(key)
          if (stored === null) {
            // Première connexion → activer par défaut + sauvegarder
            localStorage.setItem(key, 'true')
            prefTags[key] = 'true'
          } else {
            prefTags[key] = stored === 'false' ? 'false' : 'true'
          }
        })
for (const [key, value] of Object.entries(prefTags)) {
  await OneSignal.User.addTag(key, value)
}

        // 4. Demander la permission push si pas encore accordée
        // (seulement si l'utilisatrice n'a pas encore répondu)
        const permission = await OneSignal.Notifications.permissionNative
        if (permission === 'default') {
          // Attendre 3 secondes avant de demander — moins intrusif
          setTimeout(async () => {
            try {
              await OneSignal.Slidedown.promptPush()
            } catch {
              // Silencieux si le prompt est déjà affiché
            }
          }, 3000)
        }
      })
    }
  }, [])

  return null
}