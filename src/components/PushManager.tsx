'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function PushManager() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (!('PushManager' in window)) return;

    const setupPush = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('[Push] Pas d user connecte, skip');
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        console.log('[Push] Service Worker pret');

        if (Notification.permission === 'denied') {
          console.log('[Push] Notifications bloquees par l utilisateur — il faut autoriser dans les reglages du navigateur');
          return;
        }

        // ── DEMANDE ACTIVE de la permission si elle n'a jamais été demandée ──
        if (Notification.permission === 'default') {
          console.log('[Push] Demande de permission a l utilisateur...');
          const result = await Notification.requestPermission();
          if (result !== 'granted') {
            console.log('[Push] Permission refusee ou ignoree:', result);
            return;
          }
          console.log('[Push] Permission accordee !');
        }

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

        const subJson = subscription.toJSON();

        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          credentials: 'include',
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

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(() => {
      setupPush();
    });

    return () => {
      authSub.unsubscribe();
    };
  }, []);

  return null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}