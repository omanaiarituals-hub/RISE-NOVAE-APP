import { createBrowserClient } from '@supabase/ssr'

/**
 * Client Supabase pour le navigateur.
 * Options PWA : persistSession + autoRefreshToken + détection de visibilité
 * pour éviter les déconnexions quand l'app passe en arrière-plan sur mobile.
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'novae-auth',
    },
  }
)