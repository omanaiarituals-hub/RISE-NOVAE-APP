// src/app/page.tsx
// Wrapper serveur : verifie le host AVANT de rendre quoi que ce soit.
// Necessaire car le rewrite middleware seul ne suffit pas a empecher
// Next.js de resoudre directement vers ce composant pour la route "/".
import { headers } from 'next/headers'
import { readFile } from 'fs/promises'
import path from 'path'
import HomePageClient from './HomePageClient'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const isApex = host === 'novae-by-omanaia.com' || host === 'www.novae-by-omanaia.com'

  if (isApex) {
    // Sert directement le contenu de public/landing.html, sans passer
    // par le composant app client. Fiable independamment du comportement
    // du middleware/rewrite.
    const filePath = path.join(process.cwd(), 'public', 'landing.html')
    const html = await readFile(filePath, 'utf-8')
    return (
      // dangerouslySetInnerHTML est volontaire ici : landing.html est un
      // fichier statique de confiance dans le repo, pas du contenu utilisateur.
      <div dangerouslySetInnerHTML={{ __html: html }} />
    )
  }

  return <HomePageClient />
}