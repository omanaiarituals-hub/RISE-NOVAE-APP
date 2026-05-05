'use client';

import { useEffect } from 'react';
import { useUser } from '@/hooks/useUser';

declare global {
  interface Window {
    OneSignal: any;
    OneSignalDeferred: any[];
  }
}

export default function OneSignalInit() {
  const { user } = useUser();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    if (!appId) {
      console.warn('[OneSignal] App ID manquant dans les variables d environnement');
      return;
    }

    // Charger le SDK une seule fois
    if (!document.getElementById('onesignal-sdk')) {
      const script = document.createElement('script');
      script.id = 'onesignal-sdk';
      script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
      script.defer = true;
      document.head.appendChild(script);
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];

    window.OneSignalDeferred.push(async function (OneSignal: any) {
      try {
        // Eviter de re-init si deja fait
        if ((window as any).__oneSignalInitialized) {
          console.log('[OneSignal] Deja initialise, skip');
          return;
        }

        await OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerParam: { scope: '/' },
serviceWorkerPath: 'sw.js',
          notifyButton: { enable: false },
        });

        (window as any).__oneSignalInitialized = true;
        console.log('[OneSignal] Init OK avec App ID:', appId);

        // Si user connecte, on tag son user_id Supabase
        // (PAS de login() pour eviter le conflit 409 onesignalId/externalId)
        if (user?.id) {
          await OneSignal.User.addTag('user_id', user.id);
          console.log('[OneSignal] Tag user_id ajoute:', user.id);
        }
      } catch (err) {
        console.error('[OneSignal] Erreur init:', err);
      }
    });
  }, [user?.id]);

  return null;
}