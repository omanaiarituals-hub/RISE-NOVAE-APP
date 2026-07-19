// src/app/layout.tsx
// CORRECTIF (audit 02/07/2026) : NovaeProvider enveloppait toute l'app mais
// aucun composant ne consomme useNovae (vérifié : seul NovaeContext.tsx
// lui-même le référençait). Retiré : ça ne changeait rien à l'affichage,
// mais chaque page payait le coût du contexte et de son état pour rien.
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import PushManager from '@/components/PushManager'
import { SetupGuide } from '@/components/SetupGuide'
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt'
import { CookieBanner } from '@/components/CookieBanner'
import GlobalHeader from '@/components/GlobalHeader'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://app.novae-by-omanaia.com'),
  title: {
    default: 'NOVAÉ by OMANAÏA',
    template: '%s | NOVAÉ',
  },
  description: "NOVAÉ, l'application qui t'accompagne au quotidien avec NOVA, ta coach IA : programme de 90 jours, planner, routines, journaling et communauté.",
  manifest: '/manifest.json',
  verification: {
    google: 'hjmuYuyMOLOIQDTVwmHabKyghViwFTAWTEqt1o1kFgU',
  },
  openGraph: {
    title: 'NOVAÉ · Ton assistante contre la charge mentale',
    description: "NOVAÉ, l'application qui t'accompagne au quotidien avec NOVA, ta coach IA : programme de 90 jours, planner, routines, journaling et communauté.",
    url: 'https://app.novae-by-omanaia.com',
    siteName: 'NOVAÉ by OMANAÏA',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'NOVAÉ by OMANAÏA',
      },
    ],
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NOVAÉ · Ton assistante contre la charge mentale',
    description: "NOVAÉ, l'application qui t'accompagne au quotidien avec NOVA, ta coach IA.",
    images: ['/og-image.png'],
  },
  // Par défaut, l'espace applicatif (derrière connexion) n'est pas indexé.
  // Les pages publiques (ex: le blog) redéfinissent leurs propres
  // métadonnées, y compris `robots`, via generateMetadata.
  robots: {
    index: false,
    follow: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'NOVAÉ',
  },
  icons: {
    icon: '/novae-icon.svg',
    apple: '/apple-touch-icon.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'theme-color': '#F8F1E5',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={inter.className} style={{ margin: 0, background: '#F8F1E5' }}>
        <SetupGuide />
        <GlobalHeader />
        <main>
          {children}
        </main>
        <PWAInstallPrompt />
        <PushManager />
        {/* CORRECTIF (audit 02/07/2026) : CookieBanner était importé mais
            jamais rendu — aucune visiteuse n'a jamais vu de bandeau de
            consentement cookies. Composant remonté ici, sans autre
            modification (logique de consentement inchangée). */}
        <CookieBanner />
        <script dangerouslySetInnerHTML={{__html: `
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js')
    })
  }
`}} />
      </body>
    </html>
  )
}
