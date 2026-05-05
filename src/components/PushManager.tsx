'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

/**
 * Gere la souscription Web Push native (sans OneSignal).
 * - Demande la permission au navigateur
 * - Cree une PushSubscription via le Service Worker
 * - L'envoie au serveur pour stockage Supabase
 */
export default function PushManager() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (!('PushManager' in window)) return;

    const setupPush = async () => {
      try {
        // 1. Verifier que l'user est connecte
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('[Push] Pas d user connecte, skip');
          return;
        }

        // 2. Attendre que le SW soit pret
        const registration = await navigator.serviceWorker.ready;
        console.log('[Push] Service Worker pret');

        // 3. Verifier la permission
        if (Notification.permission === 'denied') {
          console.log('[Push] Notifications bloquees par l utilisateur');
          return;
        }

        // 4. Demander la permission si pas encore donnee
        if (Notification.permission === 'default') {
          // On n'auto-prompt pas, c'est l'user qui declenche depuis Settings
          console.log('[Push] Permission non encore demandee');
          return;
        }

        // 5. Recuperer ou creer la souscription
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (!vapidKey) {
            console.error('[Push] VAPID public key manquante');
            return;
          }

        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
          });
          console.log('[Push] Nouvelle souscription creee');
        } else {
          console.log('[Push] Souscription existante recuperee');
        }

        // 6. Envoyer la souscription au serveur pour stockage Supabase
        const subJson = subscription.toJSON();

        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subJson.endpoint,
            keys: subJson.keys,
            userAgent: navigator.userAgent,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          console.error('[Push] Erreur enregistrement serveur:', err);
          return;
        }

        console.log('[Push] Souscription enregistree cote serveur');
      } catch (err) {
        console.error('[Push] Erreur setup:', err);
      }
    };

    setupPush();

    // Re-run quand l'auth change (login/logout)
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(() => {
      setupPush();
    });

    return () => {
      authSub.unsubscribe();
    };
  }, []);

  return null;
}

/**
 * Convertit une cle VAPID base64 en Uint8Array (format requis par PushManager)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}