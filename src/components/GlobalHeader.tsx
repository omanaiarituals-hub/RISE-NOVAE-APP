// src/components/GlobalHeader.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Header global affiché sur toutes les pages SAUF la page d'accueil ('/').
 * Sur l'accueil, c'est le composant HomeHeader qui prend le relais
 * (avec son bandeau premium dédié).
 */
export default function GlobalHeader() {
  const pathname = usePathname()

  // Ne pas afficher sur l'accueil
  if (pathname === '/') return null

  return (
    <header
      style={{
        padding: '20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        borderBottom: '1px solid rgba(196,149,106,0.1)',
      }}
    >
      <Link href="/">
        <img
          src="/novae-logo.svg"
          alt="NOVAÉ"
          height={40}
          style={{ height: 40 }}
        />
      </Link>
    </header>
  )
}