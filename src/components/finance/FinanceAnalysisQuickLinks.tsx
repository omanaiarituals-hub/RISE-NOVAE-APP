import Link from 'next/link'

export default function FinanceAnalysisQuickLinks({
  recurringCount,
  uncategorizedCount,
}: {
  recurringCount: number
  uncategorizedCount: number
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Link
        href="/finances/upcoming"
        className="rounded-2xl border border-[var(--novae-border)] p-4 transition hover:bg-black/[.025]"
      >
        <strong>Dépenses récurrentes détectées</strong>
        <p className="mt-2 text-sm text-[var(--novae-text-muted)]">
          {recurringCount} récurrence(s) détectée(s). Clique pour confirmer, corriger ou ignorer.
        </p>
      </Link>

      <Link
        href="/finances/transactions?filter=uncategorized"
        className="rounded-2xl border border-[var(--novae-border)] p-4 transition hover:bg-black/[.025]"
      >
        <strong>Opérations à confirmer</strong>
        <p className="mt-2 text-sm text-[var(--novae-text-muted)]">
          {uncategorizedCount} opération(s) restent à catégoriser. Clique pour les corriger.
        </p>
      </Link>
    </div>
  )
}
