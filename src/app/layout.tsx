// src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
import PushManager from '@/components/PushManager'
import { SetupGuide } from '@/components/SetupGuide'
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt'
import { CookieBanner } from '@/components/CookieBanner'
import GlobalHeader from '@/components/GlobalHeader'
import UserThemeProvider from '@/components/theme/UserThemeProvider'
import OnboardingV2Gate from '@/components/onboarding/OnboardingV2Gate'

export const metadata: Metadata = {
  metadataBase: new URL('https://app.novae-by-omanaia.com'),
  title: {
    default: 'NOVAÉ by OMANAÏA',
    template: '%s | NOVAÉ',
  },
  description:
    'NOVAÉ centralise le quotidien, le planning, les tâches, les repas et les documents avec Nova, ton assistante de vie.',
  manifest: '/manifest.json',
  verification: {
    google: 'hjmuYuyMOLOIQDTVwmHabKyghViwFTAWTEqt1o1kFgU',
  },
  openGraph: {
    title: 'NOVAÉ · Ton assistante de vie',
    description:
      'Un seul espace pour alléger la charge mentale, organiser le quotidien et agir avec Nova après validation.',
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
    title: 'NOVAÉ · Ton assistante de vie',
    description:
      'Un seul espace pour alléger la charge mentale et organiser le quotidien avec Nova.',
    images: ['/og-image.png'],
  },
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
    'theme-color': '#FBF7F2',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <UserThemeProvider>
          <OnboardingV2Gate />
          <SetupGuide />
          <GlobalHeader />
          <main>{children}</main>
          <PWAInstallPrompt />
          <PushManager />
          <CookieBanner />
        </UserThemeProvider>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js')
                })
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
