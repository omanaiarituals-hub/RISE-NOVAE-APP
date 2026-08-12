import type { User } from '@supabase/supabase-js'
import { initializeUserData } from '@/lib/supabase/userInit'

const pendingInitializations = new Map<string, Promise<void>>()

export function ensureUserInitialized(user: User): Promise<void> {
  const existing = pendingInitializations.get(user.id)
  if (existing) return existing

  const promise = Promise.resolve(initializeUserData(user))
    .then(() => undefined)
    .finally(() => {
      // Keep the same promise through the current auth burst,
      // then allow a later genuine reinitialization attempt if needed.
      window.setTimeout(() => {
        if (pendingInitializations.get(user.id) === promise) {
          pendingInitializations.delete(user.id)
        }
      }, 1500)
    })

  pendingInitializations.set(user.id, promise)
  return promise
}
