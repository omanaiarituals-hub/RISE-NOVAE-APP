// src/lib/articles.ts
// Accès en lecture à la table Supabase "articles", côté serveur.
// Utilisé par /blog, /blog/[slug] et le sitemap. L'écriture reste gérée
// exclusivement par src/app/admin/blog/page.tsx (client, RLS admin).
//
// Client anonyme "sans cookies" volontaire (pas @/lib/supabase/server) :
// ces lectures sont publiques (policy RLS "published = true"), donc pas
// besoin de session utilisateur. Ça évite d'appeler cookies()/headers(),
// qui forcerait Next.js à rendre ces pages en dynamique pur à chaque
// requête au lieu de permettre le cache ISR (export const revalidate).
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function client() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export interface Article {
  id: string
  slug: string
  title: string
  excerpt: string | null
  cover_image: string | null
  image_alt: string | null
  category: string | null
  read_time: string | null
  display_date: string | null
  meta_title: string | null
  meta_description: string | null
  body_html: string
  faq: { q: string; a: string }[]
  published: boolean
}

export async function getPublishedArticles(): Promise<Article[]> {
  const { data } = await client()
    .from('articles')
    .select('*')
    .eq('published', true)
    .order('display_date', { ascending: false })
  return (data ?? []) as Article[]
}

export async function getPublishedArticle(slug: string): Promise<Article | null> {
  const { data } = await client()
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()
  return data as Article | null
}
