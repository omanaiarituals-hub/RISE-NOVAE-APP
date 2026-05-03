'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

declare global {
  interface Window { OneSignalDeferred: any[] }
}

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

        // Récupérer le vrai user Supabase et l'associer à OneSignal
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Associer l'External ID = user_id Supabase
          await OneSignal.login(user.id)
          // Ajouter aussi le tag pour les filtres
          await OneSignal.User.addTag('user_id', user.id)
          await OneSignal.User.addTag('email', user.email || '')
        }
      })
    }
  }, [])

  return null
}