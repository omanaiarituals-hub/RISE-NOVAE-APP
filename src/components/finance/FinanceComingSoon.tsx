import Link from 'next/link'
import Navigation from '@/components/Navigation'
import PremiumIcon from '@/components/ui/PremiumIcon'

export default function FinanceComingSoon() {
  return (
    <main className="min-h-[100dvh] pb-[110px] text-[var(--novae-text-main)] bg-[var(--novae-background)]">
      <section className="mx-auto w-[min(calc(100%-32px),920px)] py-8 sm:py-12">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-bold no-underline text-[var(--novae-text-main)]">
          <span className="rotate-180"><PremiumIcon name="chevron" width={16} height={16} /></span>
          Retour accueil
        </Link>
        <div className="grid justify-items-center rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] px-6 py-12 text-center shadow-lg sm:py-16">
          <span className="mb-6 inline-flex h-[78px] w-[78px] items-center justify-center rounded-[22px] border border-[var(--novae-metal)] bg-[var(--novae-primary)] text-[var(--novae-metal)]">
            <PremiumIcon name="wallet" width={34} height={34} />
          </span>
          <p className="m-0 text-xs font-black tracking-[.18em] text-[var(--novae-metal)]">NOVAÉ</p>
          <h1 className="mt-2 font-[var(--novae-font-title)] text-5xl font-medium sm:text-6xl">Finances</h1>
          <p className="mt-4 font-[var(--novae-font-title)] text-2xl text-[var(--novae-primary)]">Module bientôt disponible</p>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--novae-text-muted)]">
            L’espace Finance est actuellement en test privé. Il sera ouvert progressivement après validation de la sécurité et du moteur d’analyse.
          </p>
        </div>
      </section>
      <Navigation />
    </main>
  )
}
