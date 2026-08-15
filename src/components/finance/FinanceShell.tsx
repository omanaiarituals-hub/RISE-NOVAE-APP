import Link from 'next/link'
import type { ReactNode } from 'react'
import Navigation from '@/components/Navigation'

const items = [
  { href: '/finances', label: 'Vue d’ensemble' },
  { href: '/finances/envelopes', label: 'Enveloppes' },
  { href: '/finances/goals', label: 'Objectifs' },
  { href: '/finances/upcoming', label: 'À venir' },
  { href: '/finances/transactions', label: 'Transactions' },
  { href: '/finances/analysis', label: 'Analyse' },
  { href: '/finances/nova', label: 'Nova' },
  { href: '/finances/cash', label: 'Espèces' },
  { href: '/finances/card-free', label: 'Sans carte' },
  { href: '/finances/banking', label: 'Banque' },
]

export default function FinanceShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-[var(--novae-background)] pb-[110px] text-[var(--novae-text-main)]">
      <div className="mx-auto w-[min(calc(100%-24px),1180px)] py-5 sm:w-[min(calc(100%-32px),1180px)] sm:py-8">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/" className="text-xs font-bold text-[var(--novae-text-muted)] no-underline">← Accueil</Link>
            <h1 className="mt-1 font-[var(--novae-font-title)] text-3xl font-semibold sm:text-4xl">Finances</h1>
          </div>
          <span className="rounded-full border border-[var(--novae-border)] bg-[var(--novae-surface)] px-3 py-2 text-xs font-bold text-[var(--novae-text-muted)]">
            Test privé · lecture seule
          </span>
        </header>

        <nav aria-label="Navigation Finance" className="mb-6 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full border border-[var(--novae-border)] bg-[var(--novae-surface)] px-4 py-2 text-sm font-bold text-[var(--novae-text-main)] no-underline transition hover:-translate-y-0.5"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {children}
      </div>
      <Navigation />
    </main>
  )
}
