// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { NovaeProvider } from '@/context/NovaeContext'
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
        <NovaeProvider>
          <SetupGuide />
          <GlobalHeader />
          <main>
            {children}
          </main>
        </NovaeProvider>
        <PWAInstallPrompt />
        <PushManager />
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