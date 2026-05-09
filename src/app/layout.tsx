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
  title: 'RISE NOVAÉ',
  description: 'Ton compagnon de transformation personnelle',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RISE NOVAÉ',
  },
  icons: {
    icon: '/novae-icon.svg',
    apple: '/apple-touch-icon.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'theme-color': '#1C1A18',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={inter.className} style={{ margin: 0, background: '#1C1A18' }}>
        <NovaeProvider>
          <SetupGuide />

          {/* Header global — caché sur la page d'accueil uniquement (logique dans GlobalHeader) */}
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