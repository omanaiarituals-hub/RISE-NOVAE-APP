'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import FinanceUpcomingPreview from '@/components/finance/FinanceUpcomingPreview'

type Envelope = { id: string; name: string; target_amount: number | string; current_amount: number | string }
type Goal = { id: string; name: string; target_amount: number | string; current_amount: number | string }
type Forecast = { base_balance: number | null; projected_bank_balance: number | null; real_available: number | null; cash_total: number }
type Dashboard = {
  bank: { connected: boolean; balance: number | null; source: string; active_accounts: number; last_synced_at: string | null }
  transactions: { count: number }
  forecast: Forecast
  envelopes: Envelope[]
  primary_goal: Goal | null
  overdraft: { current: number; limit: number } | null
  onboarding_completed: boolean
}

const money = (value: number | string | null | undefined) => value == null
  ? '—'
  : Number(value || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })

function dateTime(value: string | null | undefined) {
  if (!value) return 'Jamais'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date inconnue'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export default function FinanceDashboard() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/finance/dashboard', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.detail || payload.error || 'Impossible de charger Finance.')
      setData(payload)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de charger Finance.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading && !data) {
    return (
      <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-6 sm:p-8">
        <p className="text-sm font-black">Chargement de ton pilotage financier…</p>
        <p className="mt-2 text-sm text-[var(--novae-text-muted)]">NOVAÉ rassemble le solde, les enveloppes, les objectifs et les réserves.</p>
      </section>
    )
  }

  if (error && !data) {
    return (
      <section className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-900 sm:p-8">
        <p className="font-black">Finance n’a pas pu se charger.</p>
        <p className="mt-2 text-sm">{error}</p>
        <button type="button" onClick={() => void load()} className="mt-4 rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-black">Réessayer</button>
      </section>
    )
  }

  const goal = data?.primary_goal ?? null
  const target = Number(goal?.target_amount || 0)
  const current = Number(goal?.current_amount || 0)
  const progress = target > 0 ? Math.min(100, Math.max(0, current / target * 100)) : 0

  return (
    <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
      {data && !data.onboarding_completed ? (
        <section className="rounded-[24px] border border-[var(--novae-primary)]/25 bg-[var(--novae-surface)] p-5 sm:p-6 lg:col-span-2">
          <p className="text-xs font-black uppercase tracking-[.16em] text-[var(--novae-primary)]">Diagnostic Finance</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Calibrer Nova sur ta situation réelle</h2>
              <p className="mt-1 max-w-2xl text-sm text-[var(--novae-text-muted)]">Revenu, jour de paie, seuil de sécurité et propositions basées sur l’historique. Rien n’est créé sans validation.</p>
            </div>
            <Link href="/finances/onboarding" className="rounded-full bg-[var(--novae-primary)] px-5 py-3 text-sm font-black text-white no-underline">Faire le diagnostic →</Link>
          </div>
        </section>
      ) : null}

      <section className="rounded-[28px] bg-gradient-to-br from-[var(--novae-primary)] to-[var(--novae-hero-end)] p-5 text-white shadow-lg sm:p-8">
        <p className="text-sm font-bold opacity-85">Disponible réellement</p>
        <p className="mt-2 text-5xl font-black tracking-tight sm:text-6xl">{money(data?.forecast.real_available)} €</p>
        <p className="mt-3 max-w-xl text-sm leading-6 opacity-90">Solde connu, retraits/transferts saisis, charges à venir, provisions et plancher de sécurité sont déjà intégrés.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/finances/cash" className="rounded-full bg-white px-5 py-3 text-sm font-black text-[var(--novae-primary)] no-underline">Gérer mes enveloppes physiques</Link>
          <Link href="/finances/nova" className="rounded-full border border-white/45 px-5 py-3 text-sm font-black text-white no-underline">Simuler une décision</Link>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs font-bold opacity-80">Solde connu</p><p className="mt-1 text-2xl font-black">{money(data?.forecast.base_balance)} €</p></div>
          <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs font-bold opacity-80">Après réserves</p><p className="mt-1 text-2xl font-black">{money(data?.forecast.projected_bank_balance)} €</p></div>
          <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs font-bold opacity-80">Cash en enveloppes</p><p className="mt-1 text-2xl font-black">{money(data?.forecast.cash_total)} €</p></div>
        </div>
      </section>

      {goal ? (
        <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-6">
          <p className="text-sm font-black text-[var(--novae-text-muted)]">Objectif prioritaire</p>
          <h2 className="mt-2 font-[var(--novae-font-title)] text-2xl font-semibold">{goal.name}</h2>
          <p className="mt-3 text-sm"><strong>{money(current)} €</strong> / {money(target)} €</p>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-[var(--novae-primary)]" style={{ width: `${progress}%` }} /></div>
          <Link href={`/finances/goals/${goal.id}`} className="mt-4 inline-flex text-sm font-black text-[var(--novae-primary)] no-underline">Voir l’objectif →</Link>
        </section>
      ) : (
        <section className="rounded-[28px] border border-dashed border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-6">
          <p className="text-sm font-black text-[var(--novae-text-muted)]">Objectifs</p>
          <h2 className="mt-2 text-2xl font-semibold">Aucun objectif prioritaire</h2>
          <Link href="/finances/goals" className="mt-4 inline-flex text-sm font-black text-[var(--novae-primary)] no-underline">Ajouter un objectif →</Link>
        </section>
      )}

      {data?.overdraft ? (
        <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-amber-950 lg:col-span-2">
          <p className="text-sm font-black">Découvert configuré</p>
          <p className="mt-1 text-sm">Découvert actuel déclaré : <strong>{money(data.overdraft.current)} €</strong>{data.overdraft.limit > 0 ? ` · autorisation ${money(data.overdraft.limit)} €` : ''}.</p>
        </section>
      ) : null}

      <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-6 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-black text-[var(--novae-text-muted)]">Mes enveloppes</p><h2 className="mt-1 text-2xl font-semibold">Budget à piloter</h2></div>
          <Link href="/finances/envelopes" className="text-sm font-black text-[var(--novae-primary)] no-underline">Toutes les enveloppes →</Link>
        </div>
        {data && data.envelopes.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[var(--novae-border)] p-6 text-center">
            <p className="font-bold">Aucune enveloppe configurée</p>
            <Link href="/finances/nova" className="mt-3 inline-flex text-sm font-black text-[var(--novae-primary)] no-underline">Laisser Nova me proposer un budget →</Link>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {data?.envelopes.map((item) => (
              <Link key={item.id} href={`/finances/envelopes/${item.id}`} className="rounded-2xl border border-[var(--novae-border)] p-4 text-[var(--novae-text-main)] no-underline">
                <strong>{item.name}</strong>
                <p className="mt-3 text-2xl font-black">{money(item.current_amount)} € <span className="text-sm font-semibold text-[var(--novae-text-muted)]">/ {money(item.target_amount)} €</span></p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <FinanceUpcomingPreview />
      <Link href="/finances/nova" className="rounded-[24px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 text-[var(--novae-text-main)] no-underline">
        <p className="text-sm font-black">Et si ?</p><p className="mt-2 text-sm text-[var(--novae-text-muted)]">Tester une dépense, une économie ou une variation de revenu avant de décider.</p>
      </Link>

      {error ? <div className="rounded-2xl bg-red-50 p-4 text-red-800 lg:col-span-2">{error}</div> : null}
    </div>
  )
}
