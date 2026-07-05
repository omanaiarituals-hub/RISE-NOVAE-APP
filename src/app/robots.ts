import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'

// robots.txt dynamique : les deux domaines (novae-by-omanaia.com et
// app.novae-by-omanaia.com) partagent le même déploiement Next.js.
//
// DÉCISION SEO (05/07/2026) : le blog est référencé UNIQUEMENT sur le
// domaine vitrine (novae-by-omanaia.com). Le blog reste accessible dans
// l'app pour les utilisatrices connectées, mais sa version canonique
// (celle que Google indexe) est celle de la vitrine.
//
// - novae-by-omanaia.com (vitrine) : tout indexable, y compris le blog.
//   On déclare les deux sitemaps, dont sitemap-app.xml qui liste les articles.
// - app.novae-by-omanaia.com (appli) : rien n'est indexable. L'espace
//   personnel est privé, et le blog y fait doublon avec la vitrine (la
//   balise canonique de chaque article pointe déjà vers la vitrine).
export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const isApp = host.startsWith('app.')

  if (isApp) {
    // Domaine de l'application : on ne laisse rien explorer.
    return {
      rules: [
        {
          userAgent: '*',
          disallow: ['/'],
        },
      ],
    }
  }

  // Domaine vitrine : tout indexable, sauf l'API et la page de succès Stripe.
  // On déclare les deux sitemaps. sitemap-app.xml contient les articles de blog
  // (URL sur novae-by-omanaia.com), sitemap.xml contient les pages principales.
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/subscribe/success'],
      },
    ],
    sitemap: [
      'https://novae-by-omanaia.com/sitemap.xml',
      'https://novae-by-omanaia.com/sitemap-app.xml',
    ],
  }
}