'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import FinanceTransactionsBulkActions from '@/components/finance/FinanceTransactionsBulkActions'

type Item = {
  id: string
  transaction_date: string
  amount: number
  currency: string
  label: string
  account: string | null
  masked: string | null
  category: string | null
  nature: string | null
  confidence: number | null
  userCorrected: boolean
}

type Category = { id: string; name: string }

const natureLabel: Record<string, string> = {
  income: 'Revenu',
  expense: 'Dépense',
  internal_transfer: 'Transfert interne',
  third_party_advance: 'Avance',
  refund: 'Remboursement',
  reimbursable_expense: 'À rembourser',
  exceptional_expense: 'Exceptionnelle',
  installment: 'Paiement fractionné',
  subscription: 'Abonnement',
  cash_withdrawal: 'Retrait espèces',
  cash_expense: 'Dépense espèces',
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(value)
}

function date(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(
    new Date(`${value}T12:00:00`),
  )
}

export default function FinanceTransactionList({
  items,
  categories,
}: {
  items: Item[]
  categories: Category[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const uncategorizedOnly = searchParams.get('filter') === 'uncategorized'

  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])

  const visibleItems = useMemo(
    () => uncategorizedOnly ? items.filter((item) => !item.category) : items,
    [items, uncategorizedOnly],
  )

  const visibleIds = useMemo(() => visibleItems.map((item) => item.id), [visibleItems])
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id))

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  function toggleAllVisible() {
    setSelected((current) => {
      const currentSet = new Set(current)
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => currentSet.has(id))
      if (allSelected) return current.filter((id) => !visibleIds.includes(id))
      for (const id of visibleIds) currentSet.add(id)
      return Array.from(currentSet)
    })
  }

  async function analyse() {
    setRunning(true)
    setMessage(null)
    const response = await fetch('/api/finance/transactions/analyse', { method: 'POST' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(payload.detail || payload.error || 'Analyse impossible.')
    } else {
      setMessage(
        `${payload.analysed} opération(s) analysée(s), ${payload.recurring_patterns} récurrence(s) détectée(s).`,
      )
      setSelected([])
      router.refresh()
    }
    setRunning(false)
  }

  function afterBulkUpdate() {
    setMessage(`${selected.length} opération(s) catégorisée(s).`)
    setSelected([])
    router.refresh()
  }

  return (
    <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-[var(--novae-primary)]">Lecture bancaire</p>
          <h2 className="mt-2 font-[var(--novae-font-title)] text-3xl font-semibold">Transactions</h2>
          <p className="mt-2 text-sm text-[var(--novae-text-muted)]">
            Catégorisation déterministe + corrections apprises par marchand.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-[var(--novae-border)] px-3 py-2 text-xs font-bold">
            {visibleItems.length} opération(s)
          </span>
          <button
            onClick={() => void analyse()}
            disabled={running || items.length === 0}
            className="rounded-full bg-[var(--novae-primary)] px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? 'Analyse…' : 'Analyser les opérations'}
          </button>
        </div>
      </div>

      {uncategorizedOnly && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-950">
          <span><strong>Filtre actif :</strong> opérations non catégorisées.</span>
          <Link href="/finances/transactions" className="font-black text-[var(--novae-primary)]">Voir toutes les opérations →</Link>
        </div>
      )}

      {message && <div className="mt-4 rounded-2xl bg-black/[.04] p-3 text-sm">{message}</div>}

      {!visibleItems.length ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[var(--novae-border)] bg-[var(--novae-background)] p-5 text-sm text-[var(--novae-text-muted)]">
          <p className="font-bold text-[var(--novae-text-main)]">
            {uncategorizedOnly ? 'Aucune opération non catégorisée.' : 'Aucune opération à analyser.'}
          </p>
          {!uncategorizedOnly && (
            <>
              <p className="mt-1">Connecte ou synchronise un compte bancaire inclus dans NOVAÉ.</p>
              <Link href="/finances/banking" className="mt-3 inline-flex rounded-full border border-[var(--novae-border)] bg-[var(--novae-surface)] px-4 py-2 text-xs font-black text-[var(--novae-text-main)] no-underline">
                Gérer mes comptes →
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-black">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
                className="h-4 w-4 accent-[var(--novae-primary)]"
              />
              Tout sélectionner
            </label>
            <span className="text-xs text-[var(--novae-text-muted)]">
              Coche plusieurs opérations pour leur appliquer la même catégorie.
            </span>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--novae-border)]">
            {visibleItems.map((item, index) => (
              <div
                key={item.id}
                className={`grid grid-cols-[28px_56px_1fr_auto] items-start gap-3 p-4 transition hover:bg-black/[.025] ${
                  index ? 'border-t border-[var(--novae-border)]' : ''
                } ${selectedSet.has(item.id) ? 'bg-[var(--novae-primary)]/[.035]' : ''}`}
              >
                <input
                  type="checkbox"
                  aria-label={`Sélectionner ${item.label}`}
                  checked={selectedSet.has(item.id)}
                  onChange={() => toggle(item.id)}
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--novae-primary)]"
                />
                <div className="text-xs font-bold text-[var(--novae-text-muted)]">
                  {date(item.transaction_date)}
                </div>
                <Link href={`/finances/transactions/${item.id}`} className="min-w-0 text-[var(--novae-text-main)] no-underline">
                  <p className="truncate font-bold">{item.label}</p>
                  <p className="mt-1 truncate text-xs text-[var(--novae-text-muted)]">
                    {item.category || 'À catégoriser'}
                    {item.nature ? ` · ${natureLabel[item.nature] || item.nature}` : ''}
                    {item.account ? ` · ${item.account}` : ''}
                    {item.masked ? ` ${item.masked}` : ''}
                  </p>
                  {item.userCorrected && (
                    <span className="mt-1 inline-block rounded-full bg-black/[.05] px-2 py-1 text-[10px] font-black">
                      Corrigé · appris
                    </span>
                  )}
                </Link>
                <Link
                  href={`/finances/transactions/${item.id}`}
                  className={`whitespace-nowrap text-right font-black no-underline ${
                    item.amount >= 0 ? 'text-emerald-700' : 'text-[var(--novae-text-main)]'
                  }`}
                >
                  {money(item.amount, item.currency || 'EUR')}
                </Link>
              </div>
            ))}
          </div>

          <FinanceTransactionsBulkActions
            selectedIds={selected}
            categories={categories}
            onDone={afterBulkUpdate}
          />
        </>
      )}
    </section>
  )
}
