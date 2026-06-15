import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'

// robots.txt dynamique : les deux domaines (novae-by-omanaia.com et
// app.novae-by-omanaia.com) partagent le même déploiement Next.js.
// On adapte les règles selon le domaine appelant :
// - novae-by-omanaia.com (landing) : tout indexable.
// - app.novae-by-omanaia.com (appli) : seul le blog est indexable,
//   le reste de l'app (espace personnel, derrière connexion) ne doit
//   pas être exploré par Google.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const isApp = host.startsWith('app.')

  if (isApp) {
    return {
      rules: [
        {
          userAgent: '*',
          allow: ['/blog/'],
          disallow: ['/'],
        },
      ],
      sitemap: 'https://novae-by-omanaia.com/sitemap.xml',
    }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/subscribe/success'],
      },
    ],
    sitemap: 'https://novae-by-omanaia.com/sitemap.xml',
  }
}