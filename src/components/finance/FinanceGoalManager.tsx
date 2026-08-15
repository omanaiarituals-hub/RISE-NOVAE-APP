'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

type Goal = {
  id: string
  name: string
  goal_type: 'overdraft' | 'emergency_fund' | 'travel' | 'project' | 'debt' | 'savings' | 'custom'
  target_amount: number | string
  current_amount: number | string
  target_date: string | null
  priority: number
  monthly_target: number | string | null
  status: 'active' | 'paused' | 'completed' | 'cancelled'
}

type FormState = {
  name: string
  goal_type: Goal['goal_type']
  target_amount: string
  current_amount: string
  target_date: string
  monthly_target: string
  priority: string
  status: Goal['status']
}

const emptyForm: FormState = { name: '', goal_type: 'savings', target_amount: '', current_amount: '0', target_date: '', monthly_target: '', priority: '100', status: 'active' }
const labels: Record<Goal['goal_type'], string> = { overdraft: 'Sortie de découvert', emergency_fund: 'Épargne de sécurité', travel: 'Voyage', project: 'Projet', debt: 'Dette', savings: 'Épargne', custom: 'Personnalisé' }
function money(value: number | string | null) { return Number(value || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) }

export default function FinanceGoalManager() {
  const [items, setItems] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const response = await fetch('/api/finance/goals', { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.detail || payload.error || 'Impossible de charger les objectifs.')
    else setItems(payload.goals ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  function startCreate() { setEditingId(null); setForm({ ...emptyForm, priority: String((items.length + 1) * 10) }); setShowForm(true) }
  function startEdit(item: Goal) { setEditingId(item.id); setForm({ name: item.name, goal_type: item.goal_type, target_amount: String(item.target_amount), current_amount: String(item.current_amount), target_date: item.target_date ?? '', monthly_target: item.monthly_target == null ? '' : String(item.monthly_target), priority: String(item.priority), status: item.status }); setShowForm(true) }

  async function save() {
    setSaving(true); setError(null)
    const response = await fetch(editingId ? `/api/finance/goals/${editingId}` : '/api/finance/goals', { method: editingId ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, target_amount: Number(form.target_amount), current_amount: Number(form.current_amount || 0), monthly_target: form.monthly_target ? Number(form.monthly_target) : null, target_date: form.target_date || null, priority: Number(form.priority || 100) }) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.detail || payload.error || 'Impossible d’enregistrer cet objectif.')
    else { setShowForm(false); setEditingId(null); setForm(emptyForm); await load() }
    setSaving(false)
  }

  async function remove(item: Goal) {
    if (!window.confirm(`Supprimer l’objectif « ${item.name} » ?`)) return
    const response = await fetch(`/api/finance/goals/${item.id}`, { method: 'DELETE' })
    if (!response.ok) { const payload = await response.json().catch(() => ({})); setError(payload.detail || payload.error || 'Impossible de supprimer cet objectif.'); return }
    await load()
  }

  return <div className="grid gap-5">
    <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[var(--novae-primary)]">Priorités</p><h2 className="mt-2 font-[var(--novae-font-title)] text-3xl font-semibold">Mes objectifs</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--novae-text-muted)]">Découvert, voyage, épargne ou projet : rien n’est supposé. Tu crées ce qui correspond réellement à ta situation.</p></div><div className="flex flex-wrap gap-2"><Link href="/finances/nova" className="rounded-full border border-[var(--novae-border)] px-5 py-3 text-sm font-black text-[var(--novae-primary)] no-underline">Laisser Nova proposer</Link><button type="button" onClick={startCreate} className="rounded-full bg-[var(--novae-primary)] px-5 py-3 text-sm font-black text-white">+ Ajouter un objectif</button></div></div></section>
    {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {showForm && <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-7"><div className="flex items-center justify-between gap-3"><h3 className="font-[var(--novae-font-title)] text-2xl font-semibold">{editingId ? 'Modifier l’objectif' : 'Nouvel objectif'}</h3><button type="button" onClick={() => setShowForm(false)} className="text-sm font-bold text-[var(--novae-text-muted)]">Fermer</button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-bold">Nom<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex. Voyage au Japon" className="rounded-2xl border border-[var(--novae-border)] bg-transparent px-4 py-3 font-normal" /></label><label className="grid gap-2 text-sm font-bold">Type<select value={form.goal_type} onChange={(e) => setForm({ ...form, goal_type: e.target.value as Goal['goal_type'] })} className="rounded-2xl border border-[var(--novae-border)] bg-[var(--novae-surface)] px-4 py-3 font-normal"><option value="savings">Épargne</option><option value="emergency_fund">Épargne de sécurité</option><option value="travel">Voyage</option><option value="project">Projet</option><option value="debt">Dette</option><option value="overdraft">Sortie de découvert</option><option value="custom">Personnalisé</option></select></label><label className="grid gap-2 text-sm font-bold">Montant cible (€)<input type="number" min="0.01" step="0.01" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} className="rounded-2xl border border-[var(--novae-border)] bg-transparent px-4 py-3 font-normal" /></label><label className="grid gap-2 text-sm font-bold">Déjà constitué (€)<input type="number" min="0" step="0.01" value={form.current_amount} onChange={(e) => setForm({ ...form, current_amount: e.target.value })} className="rounded-2xl border border-[var(--novae-border)] bg-transparent px-4 py-3 font-normal" /></label><label className="grid gap-2 text-sm font-bold">Contribution mensuelle souhaitée (€)<input type="number" min="0" step="0.01" value={form.monthly_target} onChange={(e) => setForm({ ...form, monthly_target: e.target.value })} className="rounded-2xl border border-[var(--novae-border)] bg-transparent px-4 py-3 font-normal" /></label><label className="grid gap-2 text-sm font-bold">Date cible<input type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} className="rounded-2xl border border-[var(--novae-border)] bg-transparent px-4 py-3 font-normal" /></label>{editingId && <label className="grid gap-2 text-sm font-bold">Statut<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Goal['status'] })} className="rounded-2xl border border-[var(--novae-border)] bg-[var(--novae-surface)] px-4 py-3 font-normal"><option value="active">Actif</option><option value="paused">En pause</option><option value="completed">Atteint</option></select></label>}</div><div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => void save()} disabled={saving || !form.name.trim() || !form.target_amount} className="rounded-full bg-[var(--novae-primary)] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? 'Enregistrement…' : editingId ? 'Enregistrer les modifications' : 'Créer l’objectif'}</button><button type="button" onClick={() => setShowForm(false)} className="rounded-full border border-[var(--novae-border)] px-5 py-3 text-sm font-black">Annuler</button></div></section>}
    {loading ? <div className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-7 text-sm text-[var(--novae-text-muted)]">Chargement…</div> : items.length === 0 ? <section className="rounded-[28px] border border-dashed border-[var(--novae-border)] bg-[var(--novae-surface)] p-8 text-center"><h3 className="font-[var(--novae-font-title)] text-2xl font-semibold">Aucun objectif configuré</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--novae-text-muted)]">Tu peux utiliser Finance sans objectif. Si tu en ajoutes un, il apparaîtra ensuite sur ton tableau de bord selon sa priorité.</p><button type="button" onClick={startCreate} className="mt-5 rounded-full bg-[var(--novae-primary)] px-5 py-3 text-sm font-black text-white">Ajouter mon premier objectif</button></section> : <div className="grid gap-4 md:grid-cols-2">{items.map((item, index) => { const target = Number(item.target_amount || 0); const current = Number(item.current_amount || 0); const percent = target > 0 ? Math.min(100, Math.max(0, current / target * 100)) : 0; return <article key={item.id} className="rounded-[24px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[var(--novae-text-muted)]">{labels[item.goal_type]}</p><Link href={`/finances/goals/${item.id}`} className="mt-1 block text-lg font-black text-[var(--novae-text-main)] no-underline">{item.name}</Link></div><span className="rounded-full bg-black/5 px-2 py-1 text-xs font-bold">Priorité {index + 1}</span></div><p className="mt-4 text-2xl font-black">{money(current)} € <span className="text-sm font-semibold text-[var(--novae-text-muted)]">/ {money(target)} €</span></p><div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-[var(--novae-primary)]" style={{ width: `${percent}%` }} /></div><p className="mt-2 text-xs text-[var(--novae-text-muted)]">{Math.round(percent)} % atteint{item.monthly_target ? ` · ${money(item.monthly_target)} €/mois` : ''}</p><div className="mt-4 flex gap-2"><button type="button" onClick={() => startEdit(item)} className="rounded-full border border-[var(--novae-border)] px-3 py-2 text-xs font-black">Modifier</button><button type="button" onClick={() => void remove(item)} className="rounded-full border border-[var(--novae-border)] px-3 py-2 text-xs font-black text-red-700">Supprimer</button></div></article> })}</div>}
  </div>
}
