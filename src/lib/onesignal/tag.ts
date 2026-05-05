import { supabase } from '@/lib/supabase/client';

/**
 * Met a jour les tags OneSignal via l'API REST v1 (serveur).
 * Bypass le SDK v16 qui a un bug 409 sur le PATCH des tags.
 */
async function callTagsApi(tags: Record<string, string>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[OneSignal] Pas d user connecte, skip tags');
    return;
  }

  try {
    const res = await fetch('/api/notifications/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, tags }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('[OneSignal] API tags erreur:', err);
      return;
    }

    console.log('[OneSignal] Tags synchronises via API REST:', tags);
  } catch (err) {
    console.error('[OneSignal] Erreur fetch tags API:', err);
  }
}

/**
 * Ajoute ou met a jour un tag de preference.
 * Usage: setOneSignalTag('notif_routines', 'true')
 */
export async function setOneSignalTag(key: string, value: string): Promise<void> {
  await callTagsApi({ [key]: value });
}

/**
 * Ajoute plusieurs tags en une fois.
 * Usage: setOneSignalTags({ notif_routines: 'true', notif_communaute: 'false' })
 */
export async function setOneSignalTags(tags: Record<string, string>): Promise<void> {
  await callTagsApi(tags);
}

/**
 * Supprime un tag (en mettant la valeur a vide cote OneSignal).
 */
export async function removeOneSignalTag(key: string): Promise<void> {
  await callTagsApi({ [key]: '' });
}