import { createBrowserClient } from '@supabase/ssr'

console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('Supabase Key présente:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'OUI' : 'NON')

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
