'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

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

const natureLabel: Record<string, string> = {
  income: 'Revenu', expense: 'Dépense', internal_transfer: 'Transfert interne', third_party_advance: 'Avance', refund: 'Remboursement', reimbursable_expense: 'À rembourser', exceptional_expense: 'Exceptionnelle', installment: 'Paiement fractionné', subscription: 'Abonnement', cash_withdrawal: 'Retrait espèces', cash_expense: 'Dépense espèces',
}

function money(value: number, currency: string) { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(value) }
function date(value: string) { return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`)) }

export default function FinanceTransactionList({ items }: { items: Item[] }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function analyse() {
    setRunning(true); setMessage(null)
    const response = await fetch('/api/finance/transactions/analyse', { method: 'POST' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setMessage(payload.detail || payload.error || 'Analyse impossible.')
    else {
      setMessage(`${payload.analysed} opération(s) analysée(s), ${payload.recurring_patterns} récurrence(s) détectée(s).`)
      router.refresh()
    }
    setRunning(false)
  }

  return <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-4 sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-black uppercase tracking-[.16em] text-[var(--novae-primary)]">Lecture bancaire</p><h2 className="mt-2 font-[var(--novae-font-title)] text-3xl font-semibold">Transactions</h2><p className="mt-2 text-sm text-[var(--novae-text-muted)]">Catégorisation déterministe + corrections apprises par marchand.</p></div>
      <div className="flex flex-wrap gap-2"><span className="rounded-full border border-[var(--novae-border)] px-3 py-2 text-xs font-bold">{items.length} opération(s)</span><button onClick={() => void analyse()} disabled={running} className="rounded-full bg-[var(--novae-primary)] px-4 py-2 text-xs font-black text-white disabled:opacity-50">{running ? 'Analyse…' : 'Analyser les opérations'}</button></div>
    </div>
    {message && <div className="mt-4 rounded-2xl bg-black/[.04] p-3 text-sm">{message}</div>}
    {!items.length ? <div className="mt-6 rounded-2xl bg-[var(--novae-background)] p-5 text-sm text-[var(--novae-text-muted)]">Aucune opération sur les comptes inclus.</div> : <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--novae-border)]">{items.map((item, index) => <Link href={`/finances/transactions/${item.id}`} key={item.id} className={`grid grid-cols-[56px_1fr_auto] gap-3 p-4 transition hover:bg-black/[.025] ${index ? 'border-t border-[var(--novae-border)]' : ''}`}>
      <div className="text-xs font-bold text-[var(--novae-text-muted)]">{date(item.transaction_date)}</div>
      <div className="min-w-0"><p className="truncate font-bold">{item.label}</p><p className="mt-1 truncate text-xs text-[var(--novae-text-muted)]">{item.category || 'À catégoriser'}{item.nature ? ` · ${natureLabel[item.nature] || item.nature}` : ''}{item.account ? ` · ${item.account}` : ''}{item.masked ? ` ${item.masked}` : ''}</p>{item.userCorrected && <span className="mt-1 inline-block rounded-full bg-black/[.05] px-2 py-1 text-[10px] font-black">Corrigé · appris</span>}</div>
      <div className={`whitespace-nowrap text-right font-black ${item.amount >= 0 ? 'text-emerald-700' : ''}`}>{money(item.amount, item.currency || 'EUR')}</div>
    </Link>)}</div>}
  </section>
}
