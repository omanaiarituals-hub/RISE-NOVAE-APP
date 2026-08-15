'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type Profile = {
  usual_income_day: number | null
  usual_net_income: number | string | null
  current_overdraft: number | string
  overdraft_limit: number | string
  manual_bank_balance?: number | string | null
  safety_floor?: number | string
}

type EnvelopeSuggestion = {
  key: string
  name: string
  envelope_type: 'monthly' | 'cumulative' | 'goal' | 'debt' | 'temporary'
  target_amount: number
  rollover_enabled: boolean
  cash_enabled: boolean
  reason: string
  confidence: 'low' | 'medium' | 'high'
}

type GoalSuggestion = {
  key: string
  name: string
  goal_type: 'overdraft' | 'emergency_fund' | 'travel' | 'project' | 'debt' | 'savings' | 'custom'
  target_amount: number
  monthly_target: number | null
  reason: string
  confidence: 'low' | 'medium' | 'high'
}

type Recommendations = {
  context: {
    usual_income: number | null
    observed_monthly_income: number | null
    observed_monthly_expenses: number | null
    current_overdraft: number
    overdraft_limit: number
    months_analysed: number
    transactions_count: number
    recurring_commitments: number
    basis: string[]
  }
  envelopes: EnvelopeSuggestion[]
  goals: GoalSuggestion[]
  warnings: string[]
}

type EditableEnvelope = EnvelopeSuggestion & { selected: boolean; targetText: string }
type EditableGoal = GoalSuggestion & { selected: boolean; targetText: string; monthlyText: string }

function money(value: number | null) {
  if (value == null) return '—'
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €'
}

export default function FinanceNovaCoach() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [income, setIncome] = useState('')
  const [incomeDay, setIncomeDay] = useState('')
  const [overdraft, setOverdraft] = useState('0')
  const [overdraftLimit, setOverdraftLimit] = useState('0')
  const [manualBalance, setManualBalance] = useState('')
  const [safetyFloor, setSafetyFloor] = useState('0')
  const [loading, setLoading] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null)
  const [envelopes, setEnvelopes] = useState<EditableEnvelope[]>([])
  const [goals, setGoals] = useState<EditableGoal[]>([])

  const loadProfile = useCallback(async () => {
    const response = await fetch('/api/finance/profile', { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) return
    const next = payload.profile as Profile | null
    setProfile(next)
    setIncome(next?.usual_net_income == null ? '' : String(next.usual_net_income))
    setIncomeDay(next?.usual_income_day == null ? '' : String(next.usual_income_day))
    setOverdraft(String(next?.current_overdraft ?? 0))
    setOverdraftLimit(String(next?.overdraft_limit ?? 0))
    setManualBalance(next?.manual_bank_balance == null ? '' : String(next.manual_bank_balance))
    setSafetyFloor(String(next?.safety_floor ?? 0))
  }, [])

  useEffect(() => { void loadProfile() }, [loadProfile])

  async function saveProfile() {
    setSavingProfile(true)
    setError(null)
    const response = await fetch('/api/finance/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        usual_net_income: income === '' ? null : Number(income),
        usual_income_day: incomeDay === '' ? null : Number(incomeDay),
        current_overdraft: Number(overdraft || 0),
        overdraft_limit: Number(overdraftLimit || 0),
        manual_bank_balance: manualBalance === '' ? null : Number(manualBalance),
        safety_floor: Number(safetyFloor || 0),
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.detail || payload.error || 'Impossible d’enregistrer la situation de départ.')
    else {
      setProfile(payload.profile)
      setSuccess('Situation de départ enregistrée. Nova peut l’utiliser dans son analyse.')
    }
    setSavingProfile(false)
  }

  async function analyse() {
    setLoading(true)
    setError(null)
    setSuccess(null)
    const response = await fetch('/api/finance/recommendations', { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(payload.detail || payload.error || 'Nova ne peut pas analyser la situation pour le moment.')
      setLoading(false)
      return
    }
    const next = payload as Recommendations
    setRecommendations(next)
    setEnvelopes(next.envelopes.map((item) => ({ ...item, selected: true, targetText: String(item.target_amount) })))
    setGoals(next.goals.map((item) => ({ ...item, selected: true, targetText: String(item.target_amount), monthlyText: item.monthly_target == null ? '' : String(item.monthly_target) })))
    setLoading(false)
  }

  const selectedCount = useMemo(() => envelopes.filter((item) => item.selected).length + goals.filter((item) => item.selected).length, [envelopes, goals])

  async function applySelected() {
    if (selectedCount === 0) return
    if (!window.confirm(`Créer ${selectedCount} proposition${selectedCount > 1 ? 's' : ''} dans ton budget ? Tu pourras tout modifier ou supprimer ensuite.`)) return
    setApplying(true)
    setError(null)
    const response = await fetch('/api/finance/recommendations/apply', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        confirmed: true,
        envelopes: envelopes.filter((item) => item.selected).map((item) => ({
          name: item.name,
          envelope_type: item.envelope_type,
          target_amount: Number(item.targetText || 0),
          rollover_enabled: item.rollover_enabled,
          cash_enabled: item.cash_enabled,
        })),
        goals: goals.filter((item) => item.selected).map((item) => ({
          name: item.name,
          goal_type: item.goal_type,
          target_amount: Number(item.targetText || 0),
          monthly_target: item.monthlyText === '' ? null : Number(item.monthlyText),
        })),
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.detail || payload.error || 'Impossible d’appliquer les propositions.')
    else {
      setSuccess(`Nova a créé ${payload.created?.envelopes ?? 0} enveloppe(s) et ${payload.created?.goals ?? 0} objectif(s). Tu gardes la main : ils restent modifiables et supprimables.`)
      await analyse()
    }
    setApplying(false)
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-7">
        <p className="text-xs font-black uppercase tracking-[.18em] text-[var(--novae-primary)]">Nova Finance</p>
        <h2 className="mt-2 font-[var(--novae-font-title)] text-3xl font-semibold">Nova propose, tu décides</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--novae-text-muted)]">Nova analyse les données disponibles, propose des montants d’enveloppes et des objectifs, puis attend ton accord. Rien n’est créé, modifié ou supprimé silencieusement.</p>
      </section>

      <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-[var(--novae-primary)]">Contexte de départ</p>
            <h3 className="mt-2 font-[var(--novae-font-title)] text-2xl font-semibold">Ce que Nova doit savoir avant la banque</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--novae-text-muted)]">Ces données sont facultatives. La synchronisation bancaire affinera ensuite les recommandations. Un découvert à 0 signifie simplement qu’il n’y en a pas.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold">Revenu net habituel (€)<input type="number" min="0" step="1" value={income} onChange={(e) => setIncome(e.target.value)} className="rounded-2xl border border-[var(--novae-border)] bg-transparent px-4 py-3 font-normal outline-none" placeholder="Ex. 3000" /></label>
          <label className="grid gap-2 text-sm font-bold">Jour habituel de paie<input type="number" min="1" max="31" value={incomeDay} onChange={(e) => setIncomeDay(e.target.value)} className="rounded-2xl border border-[var(--novae-border)] bg-transparent px-4 py-3 font-normal outline-none" placeholder="Ex. 29" /></label>
          <label className="grid gap-2 text-sm font-bold">Solde bancaire actuel (€)<input type="number" step="1" value={manualBalance} onChange={(e) => setManualBalance(e.target.value)} className="rounded-2xl border border-[var(--novae-border)] bg-transparent px-4 py-3 font-normal outline-none" placeholder="Ex. 1900" /></label>
          <label className="grid gap-2 text-sm font-bold">Plancher de sécurité (€)<input type="number" min="0" step="1" value={safetyFloor} onChange={(e) => setSafetyFloor(e.target.value)} className="rounded-2xl border border-[var(--novae-border)] bg-transparent px-4 py-3 font-normal outline-none" placeholder="Ex. 300" /></label>
          <label className="grid gap-2 text-sm font-bold">Découvert actuel (€)<input type="number" min="0" step="1" value={overdraft} onChange={(e) => setOverdraft(e.target.value)} className="rounded-2xl border border-[var(--novae-border)] bg-transparent px-4 py-3 font-normal outline-none" /></label>
          <label className="grid gap-2 text-sm font-bold">Découvert autorisé (€)<input type="number" min="0" step="1" value={overdraftLimit} onChange={(e) => setOverdraftLimit(e.target.value)} className="rounded-2xl border border-[var(--novae-border)] bg-transparent px-4 py-3 font-normal outline-none" /></label>
        </div>
        <button type="button" onClick={() => void saveProfile()} disabled={savingProfile} className="mt-5 rounded-full border border-[var(--novae-border)] px-5 py-3 text-sm font-black disabled:opacity-50">{savingProfile ? 'Enregistrement…' : profile ? 'Mettre à jour ma situation' : 'Enregistrer ma situation'}</button>
      </section>

      <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[.18em] text-[var(--novae-primary)]">Analyse</p><h3 className="mt-2 font-[var(--novae-font-title)] text-2xl font-semibold">Construire mon budget avec Nova</h3></div>
          <button type="button" onClick={() => void analyse()} disabled={loading} className="rounded-full bg-[var(--novae-primary)] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{loading ? 'Analyse…' : 'Analyser ma situation'}</button>
        </div>

        {recommendations && (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl bg-black/[.03] p-4"><p className="text-xs font-black uppercase tracking-[.12em] text-[var(--novae-text-muted)]">Revenu de référence</p><p className="mt-2 text-2xl font-black">{money(recommendations.context.observed_monthly_income ?? recommendations.context.usual_income)}</p></div>
            <div className="rounded-2xl bg-black/[.03] p-4"><p className="text-xs font-black uppercase tracking-[.12em] text-[var(--novae-text-muted)]">Dépenses observées</p><p className="mt-2 text-2xl font-black">{money(recommendations.context.observed_monthly_expenses)}</p></div>
            <div className="rounded-2xl bg-black/[.03] p-4"><p className="text-xs font-black uppercase tracking-[.12em] text-[var(--novae-text-muted)]">Historique analysé</p><p className="mt-2 text-2xl font-black">{recommendations.context.transactions_count} opérations</p></div>
          </div>
        )}

        {recommendations?.warnings.map((warning) => <div key={warning} className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{warning}</div>)}

        {recommendations && envelopes.length === 0 && goals.length === 0 && <div className="mt-5 rounded-2xl border border-dashed border-[var(--novae-border)] p-6 text-sm text-[var(--novae-text-muted)]">Nova n’a rien de nouveau à proposer : tes enveloppes/objectifs existants couvrent déjà les recommandations actuelles, ou il manque encore des données.</div>}

        {envelopes.length > 0 && <div className="mt-6"><h4 className="font-[var(--novae-font-title)] text-xl font-semibold">Enveloppes proposées</h4><div className="mt-3 grid gap-3 md:grid-cols-2">{envelopes.map((item, index) => <article key={item.key} className={`rounded-2xl border p-4 ${item.selected ? 'border-[var(--novae-primary)] bg-[var(--novae-primary)]/[.04]' : 'border-[var(--novae-border)] opacity-70'}`}><div className="flex items-start gap-3"><input aria-label={`Sélectionner ${item.name}`} type="checkbox" checked={item.selected} onChange={(e) => setEnvelopes((current) => current.map((value, i) => i === index ? { ...value, selected: e.target.checked } : value))} className="mt-1" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.name}</strong><span className="text-xs font-bold text-[var(--novae-text-muted)]">Confiance {item.confidence === 'high' ? 'élevée' : item.confidence === 'medium' ? 'moyenne' : 'prudente'}</span></div><label className="mt-3 grid gap-1 text-xs font-bold">Montant proposé (€)<input type="number" min="0" step="5" value={item.targetText} onChange={(e) => setEnvelopes((current) => current.map((value, i) => i === index ? { ...value, targetText: e.target.value } : value))} className="rounded-xl border border-[var(--novae-border)] bg-[var(--novae-surface)] px-3 py-2 text-sm font-normal" /></label><p className="mt-3 text-xs leading-5 text-[var(--novae-text-muted)]">{item.reason}</p></div></div></article>)}</div></div>}

        {goals.length > 0 && <div className="mt-6"><h4 className="font-[var(--novae-font-title)] text-xl font-semibold">Objectifs proposés</h4><div className="mt-3 grid gap-3 md:grid-cols-2">{goals.map((item, index) => <article key={item.key} className={`rounded-2xl border p-4 ${item.selected ? 'border-[var(--novae-primary)] bg-[var(--novae-primary)]/[.04]' : 'border-[var(--novae-border)] opacity-70'}`}><div className="flex items-start gap-3"><input aria-label={`Sélectionner ${item.name}`} type="checkbox" checked={item.selected} onChange={(e) => setGoals((current) => current.map((value, i) => i === index ? { ...value, selected: e.target.checked } : value))} className="mt-1" /><div className="min-w-0 flex-1"><strong>{item.name}</strong><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-bold">Cible (€)<input type="number" min="0" step="5" value={item.targetText} onChange={(e) => setGoals((current) => current.map((value, i) => i === index ? { ...value, targetText: e.target.value } : value))} className="rounded-xl border border-[var(--novae-border)] bg-[var(--novae-surface)] px-3 py-2 text-sm font-normal" /></label><label className="grid gap-1 text-xs font-bold">Effort mensuel (€)<input type="number" min="0" step="5" value={item.monthlyText} onChange={(e) => setGoals((current) => current.map((value, i) => i === index ? { ...value, monthlyText: e.target.value } : value))} className="rounded-xl border border-[var(--novae-border)] bg-[var(--novae-surface)] px-3 py-2 text-sm font-normal" /></label></div><p className="mt-3 text-xs leading-5 text-[var(--novae-text-muted)]">{item.reason}</p></div></div></article>)}</div></div>}

        {(envelopes.length > 0 || goals.length > 0) && <div className="mt-6 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void applySelected()} disabled={applying || selectedCount === 0} className="rounded-full bg-[var(--novae-primary)] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{applying ? 'Application…' : `Valider ${selectedCount} proposition${selectedCount > 1 ? 's' : ''}`}</button><p className="text-xs text-[var(--novae-text-muted)]">Tu peux modifier les montants avant validation. Après création, le CRUD manuel reste disponible.</p></div>}
      </section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">{success}</div>}
    </div>
  )
}
