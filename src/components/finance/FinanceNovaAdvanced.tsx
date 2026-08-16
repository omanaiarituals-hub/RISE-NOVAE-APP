'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type Goal = {
  id: string
  name: string
  tracking_mode: 'spend' | 'accumulate' | 'repay'
  priority: number
  target_amount: number
  current_amount: number
  remaining: number
  monthly_need: number
  progress: number
  estimated_months: number | null
}

type Plan = {
  baseline: { real_available: number | null; projected_bank_balance: number | null; safety_floor: number; next_income_date: string | null }
  scenario: { extra_spend: number; extra_savings: number; spend_reduction: number; income_delta: number; real_available: number; delta: number }
  goals: Goal[]
  arbitration: Array<{ goal_id: string; name: string; tracking_mode: string; priority: number; suggested_amount: number; reason: string }>
  unallocated_after_plan: number
  recalibrations: Array<{ envelope_id: string; name: string; current_target: number; suggested_target: number; average_extra: number; adjustments_count: number; reason: string }>
  alerts: string[]
  calculation_note: string
}

function euro(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' €'
}

function signed(value: number) {
  if (value === 0) return '0 €'
  return `${value > 0 ? '+' : '−'}${euro(Math.abs(value))}`
}

export default function FinanceNovaAdvanced() {
  const [extraSpend, setExtraSpend] = useState('0')
  const [extraSavings, setExtraSavings] = useState('0')
  const [spendReduction, setSpendReduction] = useState('0')
  const [incomeDelta, setIncomeDelta] = useState('0')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const query = useMemo(() => {
    const params = new URLSearchParams({
      extra_spend: extraSpend || '0',
      extra_savings: extraSavings || '0',
      spend_reduction: spendReduction || '0',
      income_delta: incomeDelta || '0',
    })
    return params.toString()
  }, [extraSpend, extraSavings, spendReduction, incomeDelta])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const response = await fetch(`/api/finance/nova/advanced?${query}`, { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.detail || payload.error || 'Simulation indisponible.')
    else setPlan(payload as Plan)
    setLoading(false)
  }, [query])

  useEffect(() => { void load() }, [load])

  async function applyRecalibration(item: Plan['recalibrations'][number]) {
    if (!window.confirm(`Passer le budget de « ${item.name} » de ${euro(item.current_target)} à ${euro(item.suggested_target)} ?`)) return
    setMessage(null)
    const response = await fetch('/api/finance/nova/advanced', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirmed: true, actions: [{ type: 'envelope_target', envelope_id: item.envelope_id, target_amount: item.suggested_target }] }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.detail || payload.error || 'Modification impossible.')
    else { setMessage('Budget recalibré après ta validation.'); await load() }
  }

  return <div className="grid gap-5">
    <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-7">
      <p className="text-xs font-black uppercase tracking-[.18em] text-[var(--novae-primary)]">Nova Finance avancée</p>
      <h2 className="mt-2 font-[var(--novae-font-title)] text-3xl font-semibold">Et si je change quelque chose ?</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--novae-text-muted)]">Teste une décision avant de la prendre. Les calculs sont déterministes et aucun scénario ne modifie tes données.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Dépense imprévue" value={extraSpend} onChange={setExtraSpend} hint="Ex. achat de 120 €" />
        <Field label="Épargne supplémentaire" value={extraSavings} onChange={setExtraSavings} hint="Ex. mettre 100 € de côté" />
        <Field label="Réduction de dépenses" value={spendReduction} onChange={setSpendReduction} hint="Ex. économiser 80 €" />
        <Field label="Variation de revenu" value={incomeDelta} onChange={setIncomeDelta} hint="Ex. +300 ou -200" signed />
      </div>
      <button onClick={() => void load()} disabled={loading} className="mt-4 rounded-full bg-[var(--novae-primary)] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{loading ? 'Calcul…' : 'Recalculer'}</button>
    </section>

    {plan && <>
      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Disponible réel actuel" value={euro(plan.baseline.real_available)} />
        <Metric label="Avec ce scénario" value={euro(plan.scenario.real_available)} />
        <Metric label="Impact" value={signed(plan.scenario.delta)} emphasis={plan.scenario.delta !== 0} />
      </section>

      {plan.alerts.length > 0 && <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950"><strong>À surveiller</strong><ul className="mt-2 list-disc space-y-1 pl-5">{plan.alerts.map((alert, index) => <li key={`${alert}-${index}`}>{alert}</li>)}</ul></section>}

      <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-7">
        <p className="text-xs font-black uppercase tracking-[.18em] text-[var(--novae-primary)]">Arbitrage proposé</p>
        <h3 className="mt-2 text-2xl font-black">Où irait l’argent disponible ?</h3>
        <p className="mt-2 text-sm text-[var(--novae-text-muted)]">Nova respecte d’abord tes priorités, puis tes montants mensuels. Cette proposition ne fait aucun virement.</p>
        {plan.arbitration.length === 0 ? <p className="mt-4 rounded-2xl bg-black/5 p-4 text-sm">Aucun arbitrage automatique pertinent avec les objectifs actuellement configurés.</p> : <div className="mt-4 grid gap-3">{plan.arbitration.map((item, index) => <div key={item.goal_id} className="grid gap-2 rounded-2xl border border-[var(--novae-border)] p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-sm font-black">{index + 1}</span><div><strong>{item.name}</strong><p className="mt-1 text-xs text-[var(--novae-text-muted)]">{item.reason}</p></div><span className="text-lg font-black">{euro(item.suggested_amount)}</span></div>)}</div>}
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-black/5 px-4 py-3 text-sm"><span>Reste non affecté après proposition</span><strong>{euro(plan.unallocated_after_plan)}</strong></div>
      </section>

      <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-7">
        <p className="text-xs font-black uppercase tracking-[.18em] text-[var(--novae-primary)]">Objectifs</p>
        <h3 className="mt-2 text-2xl font-black">Projection simple</h3>
        {plan.goals.length === 0 ? <p className="mt-4 text-sm text-[var(--novae-text-muted)]">Aucun objectif actif.</p> : <div className="mt-4 grid gap-3">{plan.goals.map((goal) => <div key={goal.id} className="rounded-2xl border border-[var(--novae-border)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{goal.name}</strong><span className="text-sm font-black">{goal.progress}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-[var(--novae-primary)]" style={{ width: `${Math.min(100, Math.max(0, goal.progress))}%` }} /></div><div className="mt-3 grid gap-1 text-xs text-[var(--novae-text-muted)] sm:grid-cols-3"><span>Reste : <strong>{euro(goal.remaining)}</strong></span><span>Cible mensuelle : <strong>{goal.monthly_need > 0 ? euro(goal.monthly_need) : 'à définir'}</strong></span><span>Estimation : <strong>{goal.estimated_months ? `${goal.estimated_months} mois` : '—'}</strong></span></div></div>)}</div>}
      </section>

      <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-7">
        <p className="text-xs font-black uppercase tracking-[.18em] text-[var(--novae-primary)]">Recalibrage</p>
        <h3 className="mt-2 text-2xl font-black">Tes enveloppes vivent avec toi</h3>
        <p className="mt-2 text-sm text-[var(--novae-text-muted)]">Nova propose un nouveau budget seulement après plusieurs ajustements observés. Tu dois confirmer chaque changement.</p>
        {plan.recalibrations.length === 0 ? <p className="mt-4 rounded-2xl bg-black/5 p-4 text-sm">Pas assez d’ajustements répétés pour proposer un recalibrage fiable.</p> : <div className="mt-4 grid gap-3">{plan.recalibrations.map((item) => <div key={item.envelope_id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--novae-border)] p-4"><div><strong>{item.name}</strong><p className="mt-1 text-xs text-[var(--novae-text-muted)]">{item.reason} Moyenne ajoutée : {euro(item.average_extra)}.</p><p className="mt-1 text-sm">{euro(item.current_target)} → <strong>{euro(item.suggested_target)}</strong></p></div><button onClick={() => void applyRecalibration(item)} className="rounded-full border border-[var(--novae-border)] px-4 py-2 text-sm font-black">Appliquer</button></div>)}</div>}
      </section>
    </>}

    {message && <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">{message}</div>}
    {error && <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</div>}
  </div>
}

function Field({ label, value, onChange, hint, signed = false }: { label: string; value: string; onChange: (value: string) => void; hint: string; signed?: boolean }) {
  return <label className="grid gap-2 text-sm font-black">{label}<input type="number" min={signed ? undefined : 0} step="1" value={value} onChange={(event) => onChange(event.target.value)} className="rounded-2xl border border-[var(--novae-border)] bg-transparent px-4 py-3 font-normal outline-none" /><span className="text-xs font-medium text-[var(--novae-text-muted)]">{hint}</span></label>
}

function Metric({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div className={`rounded-[24px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 ${emphasis ? 'ring-1 ring-[var(--novae-primary)]/30' : ''}`}><p className="text-xs font-bold text-[var(--novae-text-muted)]">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>
}
