'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

declare global {
  interface Window {
    OneSignal: any;
    OneSignalDeferred: any[];
  }
}

export default function OneSignalInit() {
  const [userId, setUserId] = useState<string | null>(null);

  // Recuperer l'user Supabase
  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (mounted) {
        setUserId(user?.id ?? null);
      }
    };

    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUserId(session?.user?.id ?? null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Init OneSignal + login user pour eviter conflits 409
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
        // Init une seule fois
        if (!(window as any).__oneSignalInitialized) {
          await OneSignal.init({
            appId,
            allowLocalhostAsSecureOrigin: true,
            serviceWorkerParam: { scope: '/' },
            serviceWorkerPath: 'sw.js',
            notifyButton: { enable: false },
          });

          (window as any).__oneSignalInitialized = true;
          console.log('[OneSignal] Init OK avec App ID:', appId);
        }

        // Si user connecte, on l'identifie via login() pour eviter
        // les conflits 409 entre onesignalId et external_id
        if (userId) {
          // login() lie le push subscription a l'external_id Supabase
          await OneSignal.login(userId);
          console.log('[OneSignal] User logged in avec external_id:', userId);
        }
      } catch (err) {
        console.error('[OneSignal] Erreur init/login:', err);
      }
    });
  }, [userId]);

  return null;
}