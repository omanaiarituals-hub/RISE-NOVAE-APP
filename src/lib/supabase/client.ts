import { createBrowserClient } from '@supabase/ssr'

/**
 * Client Supabase pour le navigateur.
 * Utilise les cookies (pas localStorage) pour que les Server Components
 * et les Route Handlers Next.js puissent lire la session.
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)