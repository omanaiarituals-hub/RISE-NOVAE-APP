'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Envelope = { id: string; name: string; envelope_type: string; target_amount: number | string; current_amount: number | string; priority: number }
type Goal = { id: string; name: string; goal_type: string; target_amount: number | string; current_amount: number | string; priority: number }
type Dashboard = { bank: { connected: boolean; balance: number | null; accounts_count: number }; envelopes: Envelope[]; primary_goal: Goal | null; overdraft: { current: number; limit: number } | null }

function money(value: number | string | null) { return Number(value || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) }

export default function FinanceDashboard() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/finance/dashboard', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.detail || payload.error || 'Impossible de charger le tableau de bord.')
        if (active) setData(payload)
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Impossible de charger le tableau de bord.') })
    return () => { active = false }
  }, [])

  const goal = data?.primary_goal ?? null
  const goalTarget = Number(goal?.target_amount || 0)
  const goalCurrent = Number(goal?.current_amount || 0)
  const goalPercent = goalTarget > 0 ? Math.min(100, Math.max(0, goalCurrent / goalTarget * 100)) : 0

  return <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
    <section className="rounded-[28px] bg-gradient-to-br from-[var(--novae-primary)] to-[var(--novae-hero-end)] p-5 text-white shadow-lg sm:p-8">
      <p className="text-sm font-bold opacity-85">Disponible réellement</p>
      <p className="mt-2 text-5xl font-black tracking-tight sm:text-6xl">— €</p>
      <p className="mt-3 max-w-xl text-sm leading-6 opacity-90">{data?.bank.connected ? 'Tes comptes sont disponibles. Le calcul du disponible réel sera activé après validation des charges, engagements et enveloppes.' : 'Connecte une banque en lecture seule pour commencer à rapprocher solde, dépenses et enveloppes.'}</p>
      <div className="mt-6 flex flex-wrap gap-3"><Link href="/finances/banking" className="rounded-full bg-white px-5 py-3 text-sm font-black text-[var(--novae-primary)] no-underline">{data?.bank.connected ? 'Voir mes comptes' : 'Connecter ma banque'}</Link><Link href="/finances/envelopes" className="rounded-full border border-white/45 px-5 py-3 text-sm font-black text-white no-underline">Gérer mes enveloppes</Link></div>
      {data?.bank.connected && <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs font-bold opacity-80">Solde bancaire synchronisé</p><p className="mt-1 text-2xl font-black">{money(data.bank.balance)} €</p></div><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs font-bold opacity-80">Comptes suivis</p><p className="mt-1 text-2xl font-black">{data.bank.accounts_count}</p></div></div>}
    </section>

    {goal ? <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-6"><p className="text-sm font-black text-[var(--novae-text-muted)]">Objectif prioritaire</p><h2 className="mt-2 font-[var(--novae-font-title)] text-2xl font-semibold">{goal.name}</h2><p className="mt-3 text-sm"><strong>{money(goalCurrent)} €</strong> / {money(goalTarget)} €</p><div className="mt-4 h-3 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-[var(--novae-primary)]" style={{ width: `${goalPercent}%` }} /></div><p className="mt-3 text-sm text-[var(--novae-text-muted)]">{Math.round(goalPercent)} % atteint.</p><Link href={`/finances/goals/${goal.id}`} className="mt-4 inline-flex text-sm font-black text-[var(--novae-primary)] no-underline">Voir l’objectif →</Link></section> : <section className="rounded-[28px] border border-dashed border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-6"><p className="text-sm font-black text-[var(--novae-text-muted)]">Objectifs</p><h2 className="mt-2 font-[var(--novae-font-title)] text-2xl font-semibold">Aucun objectif prioritaire</h2><p className="mt-3 text-sm leading-6 text-[var(--novae-text-muted)]">C’est normal si tu n’en as pas besoin. Tu peux ajouter un voyage, une épargne, une dette ou tout autre projet quand tu veux.</p><Link href="/finances/goals" className="mt-4 inline-flex text-sm font-black text-[var(--novae-primary)] no-underline">Ajouter un objectif →</Link></section>}

    {data?.overdraft && <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-amber-950 lg:col-span-2"><p className="text-sm font-black">Découvert configuré</p><p className="mt-1 text-sm">Découvert actuel déclaré : <strong>{money(data.overdraft.current)} €</strong>{data.overdraft.limit > 0 ? ` · autorisation ${money(data.overdraft.limit)} €` : ''}. Ce bloc n’apparaît que lorsqu’un découvert a réellement été renseigné.</p></section>}

    <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-6 lg:col-span-2"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-black text-[var(--novae-text-muted)]">Mes enveloppes</p><h2 className="mt-1 font-[var(--novae-font-title)] text-2xl font-semibold">Budget à piloter</h2></div><Link href="/finances/envelopes" className="text-sm font-black text-[var(--novae-primary)] no-underline">Toutes les enveloppes →</Link></div>{data && data.envelopes.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-[var(--novae-border)] p-6 text-center"><p className="font-bold">Aucune enveloppe configurée</p><p className="mt-1 text-sm text-[var(--novae-text-muted)]">Aucun exemple n’est ajouté automatiquement à ton budget.</p><Link href="/finances/envelopes" className="mt-3 inline-flex text-sm font-black text-[var(--novae-primary)] no-underline">Créer une enveloppe →</Link></div> : <div className="mt-5 grid gap-3 md:grid-cols-3">{data?.envelopes.map((envelope) => { const target = Number(envelope.target_amount || 0); const current = Number(envelope.current_amount || 0); const percent = target > 0 ? Math.min(100, Math.max(0, current / target * 100)) : 0; return <Link key={envelope.id} href={`/finances/envelopes/${envelope.id}`} className="rounded-2xl border border-[var(--novae-border)] p-4 text-[var(--novae-text-main)] no-underline transition hover:-translate-y-0.5 hover:shadow-md"><strong>{envelope.name}</strong><p className="mt-3 text-2xl font-black">{money(current)} € <span className="text-sm font-semibold text-[var(--novae-text-muted)]">/ {money(target)} €</span></p><div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-[var(--novae-primary)]" style={{ width: `${percent}%` }} /></div></Link> })}</div>}</section>

    {error && <div className="rounded-[24px] border border-red-200 bg-red-50 p-5 text-sm text-red-800 lg:col-span-2">{error}</div>}

    <Link href="/finances/upcoming" className="rounded-[24px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 text-[var(--novae-text-main)] no-underline transition hover:-translate-y-0.5"><p className="text-sm font-black">À venir</p><p className="mt-2 text-sm text-[var(--novae-text-muted)]">Prélèvements, abonnements et paiements fractionnés.</p></Link>
    <Link href="/finances/nova" className="rounded-[24px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 text-[var(--novae-text-main)] no-underline transition hover:-translate-y-0.5"><p className="text-sm font-black">Demander à Nova</p><p className="mt-2 text-sm text-[var(--novae-text-muted)]">Analyser un achat, ton mois ou une décision financière.</p></Link>
  </div>
}
