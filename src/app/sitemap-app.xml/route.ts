// src/app/sitemap-app.xml/route.ts
// CORRECTIF SEO (audit 04/07/2026) : remplace le fichier statique
// public/sitemap-app.xml, qu'il fallait éditer à la main à chaque nouvel
// article (un oubli = l'article jamais soumis à Google). Ici, la liste est
// générée automatiquement depuis blogArticles à chaque requête : ajouter un
// article dans src/data/blog-articles.ts suffit, rien d'autre à toucher.
// Garde exactement la même URL (/sitemap-app.xml) que robots.ts référence déjà.
import { NextResponse } from 'next/server'
import { blogArticles } from '@/data/blog-articles'

export const dynamic = 'force-dynamic'

export async function GET() {
  const urls = blogArticles
    .map(
      (article) => `  <url>
    <loc>https://app.novae-by-omanaia.com/blog/${article.slug}</loc>
    <lastmod>${article.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`
    )
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}
