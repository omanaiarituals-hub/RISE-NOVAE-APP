import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { NovaeProvider } from '@/context/NovaeContext'
import OneSignalInit from '@/components/OneSignalInit'
import Link from 'next/link'
import { SetupGuide } from '@/components/SetupGuide'

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
    icon: '/icons/icon-192x192.png',
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
          {/* Header avec le logo remplacé */}
          <header style={{ 
            padding: '20px', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            borderBottom: '1px solid rgba(196,149,106,0.1)' 
          }}>
            <Link href="/">
              <img src="/novae-logo.svg" alt="NOVAÉ" height={40} style={{ height: 40 }} />
            </Link>
          </header>

          <main>
            {children}
          </main>
        </NovaeProvider>
        
        <OneSignalInit />
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
