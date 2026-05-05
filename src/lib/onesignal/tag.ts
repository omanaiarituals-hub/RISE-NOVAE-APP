declare global {
  interface Window {
    OneSignal: any;
    OneSignalDeferred: any[];
  }
}

/**
 * Ajoute ou met a jour un tag de preference dans OneSignal.
 * Usage: setOneSignalTag('notif_routines', 'true')
 */
export function setOneSignalTag(key: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal: any) {
      try {
        await OneSignal.User.addTag(key, value);
        console.log(`[OneSignal] Tag ${key}=${value} OK`);
        resolve();
      } catch (err) {
        console.error(`[OneSignal] Erreur tag ${key}:`, err);
        reject(err);
      }
    });
  });
}

/**
 * Ajoute plusieurs tags en une fois.
 * Usage: setOneSignalTags({ notif_routines: 'true', notif_communaute: 'false' })
 */
export function setOneSignalTags(tags: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal: any) {
      try {
        await OneSignal.User.addTags(tags);
        console.log('[OneSignal] Tags multi OK:', tags);
        resolve();
      } catch (err) {
        console.error('[OneSignal] Erreur tags multi:', err);
        reject(err);
      }
    });
  });
}

/**
 * Supprime un tag.
 * Usage: removeOneSignalTag('notif_routines')
 */
export function removeOneSignalTag(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal: any) {
      try {
        await OneSignal.User.removeTag(key);
        console.log(`[OneSignal] Tag ${key} supprime`);
        resolve();
      } catch (err) {
        console.error(`[OneSignal] Erreur suppression tag ${key}:`, err);
        reject(err);
      }
    });
  });
}