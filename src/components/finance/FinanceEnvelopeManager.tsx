'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type YearStats = { spent:number; injected:number; withdrawn:number; remainder_saved:number }
type Envelope = {
  id: string
  name: string
  envelope_type: 'monthly' | 'cumulative' | 'goal' | 'debt' | 'temporary'
  target_amount: number | string
  current_amount: number | string
  cash_balance: number | string
  rollover_enabled: boolean
  cash_enabled: boolean
  priority: number
  year_stats?: YearStats
}

type FormState = {
  name: string
  envelope_type: Envelope['envelope_type']
  target_amount: string
  current_amount: string
  rollover_enabled: boolean
  cash_enabled: boolean
  priority: string
}

const emptyForm: FormState = { name:'', envelope_type:'monthly', target_amount:'', current_amount:'0', rollover_enabled:false, cash_enabled:false, priority:'100' }
const typeLabels: Record<Envelope['envelope_type'], string> = { monthly:'Mensuelle', cumulative:'Cumulative', goal:'Liée à un objectif', debt:'Dette / découvert', temporary:'Temporaire' }
const money = (value:number|string) => Number(value || 0).toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:2})

function semantics(type:Envelope['envelope_type']) {
  if (type === 'debt') return { field:'Montant déjà remboursé (€)', main:'remboursés', remaining:'Reste à rembourser', year:'Remboursé cette année' }
  if (type === 'goal' || type === 'cumulative') return { field:'Montant déjà injecté (€)', main:'constitués', remaining:'Reste à constituer', year:'Injecté cette année' }
  return { field:'Montant déjà dépensé (€)', main:'dépensés', remaining:'Reste ce cycle', year:'Dépensé cette année' }
}

export default function FinanceEnvelopeManager() {
  const [items,setItems]=useState<Envelope[]>([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false)
  const [error,setError]=useState<string|null>(null),[editingId,setEditingId]=useState<string|null>(null),[showForm,setShowForm]=useState(false)
  const [form,setForm]=useState<FormState>(emptyForm)
  const formRef = useRef<HTMLElement | null>(null)

  const load=useCallback(async()=>{setLoading(true);setError(null);const response=await fetch('/api/finance/envelopes',{cache:'no-store'});const payload=await response.json().catch(()=>({}));if(!response.ok)setError(payload.detail||payload.error||'Impossible de charger les enveloppes.');else setItems(payload.envelopes??[]);setLoading(false)},[])
  useEffect(()=>{void load()},[load])
  const total=useMemo(()=>items.reduce((sum,item)=>sum+Number(item.target_amount||0),0),[items])

  function closeForm(){setShowForm(false);setEditingId(null);setForm(emptyForm)}
  function startCreate(){setEditingId(null);setForm({...emptyForm,priority:String((items.length+1)*10)});setShowForm(true)}
  function startEdit(item:Envelope){setEditingId(item.id);setForm({name:item.name,envelope_type:item.envelope_type,target_amount:String(item.target_amount??''),current_amount:String(item.current_amount??0),rollover_enabled:item.rollover_enabled,cash_enabled:item.cash_enabled,priority:String(item.priority??100)});setShowForm(true)}
  useEffect(()=>{
    if(!showForm) return
    const frame=requestAnimationFrame(()=>formRef.current?.scrollIntoView({behavior:'smooth',block:'start'}))
    return ()=>cancelAnimationFrame(frame)
  },[showForm,editingId])
  async function save(){if(!form.name.trim()||!form.target_amount)return;setSaving(true);setError(null);const response=await fetch(editingId?`/api/finance/envelopes/${editingId}`:'/api/finance/envelopes',{method:editingId?'PATCH':'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...form,target_amount:Number(form.target_amount),current_amount:Number(form.current_amount||0),priority:Number(form.priority||100)})});const payload=await response.json().catch(()=>({}));if(!response.ok)setError(payload.detail||payload.error||'Impossible d’enregistrer cette enveloppe.');else{closeForm();await load()}setSaving(false)}
  async function remove(item:Envelope){if(!window.confirm(`Supprimer l’enveloppe « ${item.name} » ?`))return;const response=await fetch(`/api/finance/envelopes/${item.id}`,{method:'DELETE'});if(!response.ok){const payload=await response.json().catch(()=>({}));setError(payload.detail||payload.error||'Impossible de supprimer cette enveloppe.');return}await load()}

  const semantic=semantics(form.envelope_type)
  return <div className="grid gap-5">
    <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[var(--novae-primary)]">Budget</p><h2 className="mt-2 font-[var(--novae-font-title)] text-3xl font-semibold">Mes enveloppes</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--novae-text-muted)]">Le montant du cycle et le cash physique sont suivis séparément. Une enveloppe mensuelle peut repartir à zéro sans perdre son historique annuel.</p></div><div className="flex flex-wrap gap-2"><Link href="/finances/nova" className="rounded-full border border-[var(--novae-border)] px-5 py-3 text-sm font-black text-[var(--novae-primary)] no-underline">Laisser Nova proposer</Link><button type="button" onClick={startCreate} className="rounded-full bg-[var(--novae-primary)] px-5 py-3 text-sm font-black text-white">+ Créer une enveloppe</button></div></div>
      {items.length>0&&<p className="mt-5 text-sm text-[var(--novae-text-muted)]">Budget cible cumulé : <strong className="text-[var(--novae-text-main)]">{money(total)} €</strong></p>}
    </section>
    {error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {showForm&&<section ref={formRef} className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-7"><div className="flex items-center justify-between gap-3"><h3 className="font-[var(--novae-font-title)] text-2xl font-semibold">{editingId?'Modifier l’enveloppe':'Nouvelle enveloppe'}</h3><button type="button" onClick={closeForm} className="text-sm font-bold text-[var(--novae-text-muted)]">Fermer</button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="grid gap-2 text-sm font-bold">Nom<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ex. Courses, Filles, Épargne…" className="rounded-2xl border border-[var(--novae-border)] bg-transparent px-4 py-3 font-normal outline-none"/></label>
      <label className="grid gap-2 text-sm font-bold">Type<select value={form.envelope_type} onChange={e=>setForm({...form,envelope_type:e.target.value as Envelope['envelope_type']})} className="rounded-2xl border border-[var(--novae-border)] bg-[var(--novae-surface)] px-4 py-3 font-normal"><option value="monthly">Mensuelle</option><option value="cumulative">Cumulative / épargne</option><option value="temporary">Temporaire</option><option value="goal">Liée à un objectif</option><option value="debt">Dette / découvert</option></select></label>
      <label className="grid gap-2 text-sm font-bold">Montant cible (€)<input type="number" min="0" step="0.01" value={form.target_amount} onChange={e=>setForm({...form,target_amount:e.target.value})} className="rounded-2xl border border-[var(--novae-border)] bg-transparent px-4 py-3 font-normal outline-none"/></label>
      <label className="grid gap-2 text-sm font-bold">{semantic.field}<input type="number" min="0" step="0.01" value={form.current_amount} onChange={e=>setForm({...form,current_amount:e.target.value})} className="rounded-2xl border border-[var(--novae-border)] bg-transparent px-4 py-3 font-normal outline-none"/><small className="font-normal text-[var(--novae-text-muted)]">{form.envelope_type==='monthly'||form.envelope_type==='temporary'?'Ce montant correspond au cycle en cours, pas au cash encore présent.':'Ce montant représente la progression réellement constituée.'}</small></label>
      <div className="grid content-end gap-3 pb-1"><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.rollover_enabled} onChange={e=>setForm({...form,rollover_enabled:e.target.checked})}/> Reporter/réaffecter le reliquat à la clôture</label><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.cash_enabled} onChange={e=>setForm({...form,cash_enabled:e.target.checked})}/> Utilisable en enveloppe physique</label></div>
    </div><div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={()=>void save()} disabled={saving||!form.name.trim()||!form.target_amount} className="rounded-full bg-[var(--novae-primary)] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{saving?'Enregistrement…':editingId?'Enregistrer les modifications':'Créer l’enveloppe'}</button><button type="button" onClick={closeForm} className="rounded-full border border-[var(--novae-border)] px-5 py-3 text-sm font-black">Annuler</button></div></section>}

    {loading?<div className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-7 text-sm text-[var(--novae-text-muted)]">Chargement…</div>:items.length===0?<section className="rounded-[28px] border border-dashed border-[var(--novae-border)] bg-[var(--novae-surface)] p-8 text-center"><h3 className="font-[var(--novae-font-title)] text-2xl font-semibold">Aucune enveloppe pour le moment</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--novae-text-muted)]">Tu peux commencer avec une seule enveloppe. Nova peut aussi te proposer des montants adaptés à ta situation.</p><button type="button" onClick={startCreate} className="mt-5 rounded-full bg-[var(--novae-primary)] px-5 py-3 text-sm font-black text-white">Créer ma première enveloppe</button></section>:<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item,index)=>{
      const target=Number(item.target_amount||0),current=Number(item.current_amount||0),cash=Number(item.cash_balance||0),percent=target>0?Math.min(100,Math.max(0,current/target*100)):0,sem=semantics(item.envelope_type),year=item.year_stats??{spent:0,injected:0,withdrawn:0,remainder_saved:0},remaining=Math.max(0,target-current)
      return <article key={item.id} className="rounded-[24px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[var(--novae-text-muted)]">{typeLabels[item.envelope_type]}</p><Link href={`/finances/envelopes/${item.id}`} className="mt-1 block text-lg font-black text-[var(--novae-text-main)] no-underline">{item.name}</Link></div><span className="text-xs font-bold text-[var(--novae-text-muted)]">Priorité {index+1}</span></div><p className="mt-4 text-2xl font-black">{money(current)} € <span className="text-sm font-semibold text-[var(--novae-text-muted)]">/ {money(target)} €</span></p><p className="mt-1 text-xs text-[var(--novae-text-muted)]">{sem.main} · {sem.remaining} : <strong>{money(remaining)} €</strong></p><div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-[var(--novae-primary)]" style={{width:`${percent}%`}}/></div><div className="mt-3 grid gap-1 text-xs text-[var(--novae-text-muted)]"><p>{sem.year} : <strong>{money(item.envelope_type==='monthly'||item.envelope_type==='temporary'?year.spent:year.injected)} €</strong></p>{(item.envelope_type==='goal'||item.envelope_type==='cumulative')&&year.withdrawn>0&&<p>Retiré cette année : <strong>{money(year.withdrawn)} €</strong></p>}{year.remainder_saved>0&&<p>Reliquats épargnés cette année : <strong>{money(year.remainder_saved)} €</strong></p>}{item.cash_enabled&&<p>Espèces actuellement dans l’enveloppe : <strong>{money(cash)} €</strong></p>}</div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={()=>startEdit(item)} className="rounded-full border border-[var(--novae-border)] px-3 py-2 text-xs font-black">Modifier</button><button type="button" onClick={()=>void remove(item)} className="rounded-full border border-[var(--novae-border)] px-3 py-2 text-xs font-black text-red-700">Supprimer</button>{item.cash_enabled&&<span className="rounded-full bg-black/5 px-3 py-2 text-xs font-bold">Espèces</span>}{item.rollover_enabled&&<span className="rounded-full bg-black/5 px-3 py-2 text-xs font-bold">Clôture</span>}</div></article>
    })}</div>}
  </div>
}
