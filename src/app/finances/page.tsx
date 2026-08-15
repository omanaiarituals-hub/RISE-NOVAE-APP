import Link from 'next/link'

const envelopes = [
  { id: 'courses', name: 'Courses', used: 312, target: 450 },
  { id: 'filles', name: 'Filles', used: 110, target: 150 },
  { id: 'plaisir', name: 'Plaisir', used: 84, target: 180 },
]

export default function FinancesPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
      <section className="rounded-[28px] bg-gradient-to-br from-[var(--novae-primary)] to-[var(--novae-hero-end)] p-5 text-white shadow-lg sm:p-8">
        <p className="text-sm font-bold opacity-85">Disponible réellement</p>
        <p className="mt-2 text-5xl font-black tracking-tight sm:text-6xl">— €</p>
        <p className="mt-3 max-w-xl text-sm leading-6 opacity-90">
          Le calcul sera activé après la première synchronisation bancaire et la validation de tes enveloppes.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/finances/banking" className="rounded-full bg-white px-5 py-3 text-sm font-black text-[var(--novae-primary)] no-underline">Connecter ma banque</Link>
          <Link href="/finances/envelopes" className="rounded-full border border-white/45 px-5 py-3 text-sm font-black text-white no-underline">Voir mes enveloppes</Link>
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-6">
        <p className="text-sm font-black text-[var(--novae-text-muted)]">Objectif prioritaire</p>
        <h2 className="mt-2 font-[var(--novae-font-title)] text-2xl font-semibold">Sortir du découvert</h2>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-black/10"><div className="h-full w-[0%] rounded-full bg-[var(--novae-primary)]" /></div>
        <p className="mt-3 text-sm text-[var(--novae-text-muted)]">À configurer pendant l’onboarding Finance.</p>
        <Link href="/finances/goals" className="mt-4 inline-flex text-sm font-black text-[var(--novae-primary)] no-underline">Gérer mes objectifs →</Link>
      </section>

      <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-6 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-[var(--novae-text-muted)]">Mes enveloppes</p>
            <h2 className="mt-1 font-[var(--novae-font-title)] text-2xl font-semibold">Budget à piloter</h2>
          </div>
          <Link href="/finances/envelopes" className="text-sm font-black text-[var(--novae-primary)] no-underline">Toutes les enveloppes →</Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {envelopes.map((envelope) => (
            <Link key={envelope.id} href={`/finances/envelopes/${envelope.id}`} className="rounded-2xl border border-[var(--novae-border)] p-4 text-[var(--novae-text-main)] no-underline transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between gap-3"><strong>{envelope.name}</strong><span className="text-xs text-[var(--novae-text-muted)]">Exemple UX</span></div>
              <p className="mt-3 text-2xl font-black">{envelope.used} € <span className="text-sm font-semibold text-[var(--novae-text-muted)]">/ {envelope.target} €</span></p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-[var(--novae-primary)]" style={{ width: `${Math.min(100, (envelope.used / envelope.target) * 100)}%` }} /></div>
            </Link>
          ))}
        </div>
      </section>

      <Link href="/finances/upcoming" className="rounded-[24px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 text-[var(--novae-text-main)] no-underline transition hover:-translate-y-0.5">
        <p className="text-sm font-black">À venir</p><p className="mt-2 text-sm text-[var(--novae-text-muted)]">Prélèvements, abonnements et paiements fractionnés.</p>
      </Link>
      <Link href="/finances/nova" className="rounded-[24px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 text-[var(--novae-text-main)] no-underline transition hover:-translate-y-0.5">
        <p className="text-sm font-black">Demander à Nova</p><p className="mt-2 text-sm text-[var(--novae-text-muted)]">Analyser un achat, ton mois ou une décision financière.</p>
      </Link>
    </div>
  )
}
