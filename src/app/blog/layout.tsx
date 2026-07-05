// src/app/blog/layout.tsx
// CORRECTIF SEO (audit 04/07/2026) : src/app/blog/page.tsx est en 'use client'
// et ne peut donc pas définir generateMetadata (réservé aux Server Components).
// Résultat avant ce fichier : /blog héritait du noindex/nofollow global du
// layout racine (espace privé par défaut) et n'était jamais indexable, ni
// exploitable par Google pour découvrir les articles via les liens internes.
// Ce layout, lui, est un Server Component : il porte les métadonnées pour
// tout le segment /blog sans changer le fichier page.tsx ni son interactivité.
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog bien-être : charge mentale, neurosciences, CBT | NOVAÉ',
  description:
    "Des articles pour comprendre ce qui se passe dans ta tête : charge mentale, motivation, ruminations. Écrits par Ness, fondatrice de NOVAÉ, à partir des neurosciences et de la thérapie cognitive.",
  alternates: { canonical: 'https://novae-by-omanaia.com/blog' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Blog bien-être NOVAÉ',
    description:
      "Des articles pour comprendre ce qui se passe dans ta tête : charge mentale, motivation, ruminations.",
    url: 'https://novae-by-omanaia.com/blog',
    type: 'website',
    siteName: 'NOVAÉ by OMANAÏA',
    locale: 'fr_FR',
  },
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children
}