// src/app/sitemap-app.xml/route.ts
// CORRECTIF SEO (audit 04/07/2026) : remplace le fichier statique
// public/sitemap-app.xml, qu'il fallait éditer à la main à chaque nouvel
// article (un oubli = l'article jamais soumis à Google). Ici, la liste est
// générée automatiquement à chaque requête depuis la table Supabase "articles" :
// publier un article dans /admin/blog suffit, rien d'autre à toucher.
// Garde exactement la même URL (/sitemap-app.xml) que robots.ts référence déjà.
//
// CORRECTIF DOMAINE (05/07/2026) : les URL pointaient vers app.novae-by-omanaia.com,
// ce qui envoyait Google indexer le blog sur le sous-domaine de l'application au
// lieu de la vitrine. C'était la cause de l'invisibilité : les articles étaient
// déclarés sur le mauvais domaine. On génère désormais des URL sur la vitrine
// (novae-by-omanaia.com), cohérentes avec la balise canonique de chaque article.
//
// MIGRATION SUPABASE (05/07/2026) : la liste ne vient plus de
// src/data/blog-articles.ts (fichier statique) mais de la table Supabase
// "articles" (published = true), pour rester synchronisée avec /blog.
import { NextResponse } from 'next/server'
import { getPublishedArticles } from '@/lib/articles'

export const dynamic = 'force-dynamic'

export async function GET() {
  const articles = await getPublishedArticles()
  const articleUrls = articles
    .map(
      (article) => `  <url>
    <loc>https://novae-by-omanaia.com/blog/${article.slug}</loc>
    <lastmod>${article.display_date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`
    )
    .join('\n')

  // La page /blog elle-même (liste + vitrine) : point d'entrée SEO du blog.
  const blogIndexUrl = `  <url>
    <loc>https://novae-by-omanaia.com/blog</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${blogIndexUrl}
${articleUrls}
</urlset>`

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}