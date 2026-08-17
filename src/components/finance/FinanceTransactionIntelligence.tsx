'use client'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

type Tx={id:string;date:string;label:string;amount:number;currency:string}
type Cat={id:string;slug:string;name:string;amount:number;count:number;percentage:number;transactions:Tx[]}
type Fixed={id:string;name:string;commitment_type:string;amount:number;frequency:string;next_due_date:string|null;source:string;confidence:number|null}
type Data={
 period:{start:string;end:string;label:string;view:'cycle'|'year';offset:number}
 summary:{total:number;categorised:number;uncategorised:number;subscriptions:number;installments:number;recurring:number;recurring_operations:number;average_confidence:number}
 budget:{reference_income:number;observed_income:number;confirmed_fixed_reserved:number;recurring_paid:number;provisions_reserved:number;safety_floor:number;variable_spent:number;pilotable_before_variable:number;remaining_pilotable:number}
 fixed:{confirmed:Fixed[];detected:Fixed[]}
 recurring:Fixed[]
 insights:Array<{id:string;title:string;summary:string}>
 categories:Cat[]
 expense_total:number
 needs_analysis?:boolean
 active_transactions?:number
}
const palette=['#123F33','#B98A52','#7D5B4C','#6B7C6C','#B46B52','#6F6A8A','#A68A64','#7C8D9A','#9A746F','#555F54']
const money=(v:number,c='EUR')=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:c,maximumFractionDigits:2}).format(v)
const frequencyLabel=(v:string)=>v==='weekly'?'hebdo':v==='yearly'||v==='annual'?'annuelle':v==='quarterly'?'trimestrielle':'mensuelle'

export default function FinanceTransactionIntelligence(){
 const [data,setData]=useState<Data|null>(null)
 const [loading,setLoading]=useState(false)
 const [message,setMessage]=useState<string|null>(null)
 const [selected,setSelected]=useState<string|null>(null)
 const [view,setView]=useState<'cycle'|'year'>('cycle')
 const [offset,setOffset]=useState(0)
 const [fixedBusy,setFixedBusy]=useState<string|null>(null)

 const load=useCallback(async(nextView=view,nextOffset=offset)=>{
  const r=await fetch(`/api/finance/transactions/intelligence?view=${nextView}&offset=${nextOffset}`,{cache:'no-store'})
  const p=await r.json().catch(()=>({}))
  if(r.ok){
    setData(p)
    setSelected((old)=>old&&p.categories?.some((c:Cat)=>c.id===old)?old:(p.categories?.[0]?.id||null))
  } else setMessage(p.detail||p.error||'Analyse indisponible.')
 },[view,offset])

 useEffect(()=>{void load()},[load])

 async function analyse(){
  setLoading(true);setMessage(null)
  const r=await fetch('/api/finance/transactions/analyse',{method:'POST'})
  const p=await r.json().catch(()=>({}))
  if(r.ok){setMessage(`${p.analysed} opérations analysées · ${p.recurring_patterns} récurrences détectées.`);await load()}
  else setMessage(p.detail||p.error||'Analyse impossible.')
  setLoading(false)
 }

 async function fixedAction(item:Fixed,action:'confirm_fixed'|'ignore'){
  setFixedBusy(item.id);setMessage(null)
  const r=await fetch('/api/finance/upcoming',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id:item.id,action})})
  const p=await r.json().catch(()=>({}))
  if(!r.ok)setMessage(p.detail||p.error||'Modification impossible.')
  else {
   setMessage(action==='confirm_fixed'?`${item.name} est maintenant réservé comme charge fixe obligatoire.`:`${item.name} ne sera pas traité comme charge fixe.`)
   await load()
  }
  setFixedBusy(null)
 }

 function changeView(next:'cycle'|'year'){
  setView(next);setOffset(0);setSelected(null)
 }

 function moveCycle(delta:number){
  const next=Math.min(0,offset+delta)
  setOffset(next);setSelected(null)
 }

 const active=useMemo(()=>data?.categories.find(c=>c.id===selected)||null,[data,selected])
 const gradient=useMemo(()=>{
  if(!data?.categories.length)return 'conic-gradient(#e8e5df 0 100%)'
  let start=0
  return `conic-gradient(${data.categories.map((c,i)=>{const end=start+c.percentage;const s=`${palette[i%palette.length]} ${start}% ${end}%`;start=end;return s}).join(',')})`
 },[data])

 return <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-7">
  <div className="flex flex-wrap items-center justify-between gap-4">
   <div><p className="text-xs font-black uppercase tracking-[.18em] text-[var(--novae-primary)]">Analyse des transactions</p><h2 className="mt-2 font-[var(--novae-font-title)] text-3xl font-semibold">Ce que le moteur comprend</h2></div>
   <button onClick={()=>void analyse()} disabled={loading} className="rounded-full bg-[var(--novae-primary)] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{loading?'Analyse…':'Relancer l’analyse'}</button>
  </div>

  <div className="mt-5 flex flex-wrap items-center gap-2">
   <button onClick={()=>changeView('cycle')} className={`rounded-full border px-4 py-2 text-sm font-black ${view==='cycle'?'border-[var(--novae-primary)] bg-[var(--novae-primary)] text-white':'border-[var(--novae-border)]'}`}>Par cycle de paie</button>
   <button onClick={()=>changeView('year')} className={`rounded-full border px-4 py-2 text-sm font-black ${view==='year'?'border-[var(--novae-primary)] bg-[var(--novae-primary)] text-white':'border-[var(--novae-border)]'}`}>Cumul annuel</button>
   {view==='cycle'&&<div className="ml-auto flex items-center gap-2">
    <button onClick={()=>moveCycle(-1)} aria-label="Cycle précédent" className="h-10 w-10 rounded-full border border-[var(--novae-border)] text-lg font-black">‹</button>
    <strong className="min-w-[150px] text-center text-sm">{data?.period.label||'Cycle…'}</strong>
    <button disabled={offset>=0} onClick={()=>moveCycle(1)} aria-label="Cycle suivant" className="h-10 w-10 rounded-full border border-[var(--novae-border)] text-lg font-black disabled:opacity-30">›</button>
   </div>}
   {view==='year'&&<strong className="ml-auto text-sm">{data?.period.label||'Cumul annuel'}</strong>}
  </div>

  {data&&<>
   <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <div className="rounded-2xl bg-black/[.04] p-4"><small>Catégorisées</small><p className="mt-1 text-2xl font-black">{data.summary.categorised}/{data.summary.total}</p></div>
    <div className="rounded-2xl bg-black/[.04] p-4"><small>Récurrences détectées</small><p className="mt-1 text-2xl font-black">{data.summary.recurring}</p><p className="mt-1 text-xs text-[var(--novae-text-muted)]">{data.summary.recurring_operations} opération(s) dans ces séries</p></div>
    <div className="rounded-2xl bg-black/[.04] p-4"><small>Abonnements</small><p className="mt-1 text-2xl font-black">{data.summary.subscriptions}</p></div>
    <div className="rounded-2xl bg-black/[.04] p-4"><small>Paiements fractionnés</small><p className="mt-1 text-2xl font-black">{data.summary.installments}</p></div>
   </div>

   <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
    <div className="rounded-2xl border border-[var(--novae-border)] p-4"><small>Revenu du cycle</small><p className="mt-1 text-xl font-black">{money(data.budget.reference_income)}</p></div>
    <div className="rounded-2xl border border-[var(--novae-border)] p-4"><small>Charges fixes réservées</small><p className="mt-1 text-xl font-black">{money(data.budget.confirmed_fixed_reserved)}</p></div>
    <div className="rounded-2xl border border-[var(--novae-border)] p-4"><small>Provisions</small><p className="mt-1 text-xl font-black">{money(data.budget.provisions_reserved)}</p></div>
    <div className="rounded-2xl border border-[var(--novae-border)] p-4"><small>Dépenses variables</small><p className="mt-1 text-xl font-black">{money(data.budget.variable_spent)}</p></div>
    <div className="rounded-2xl border border-[var(--novae-primary)] bg-[var(--novae-primary)]/[.04] p-4"><small>Reste pilotable</small><p className="mt-1 text-xl font-black">{money(data.budget.remaining_pilotable)}</p><p className="mt-1 text-[11px] text-[var(--novae-text-muted)]">après fixes, provisions, sécurité et variable déjà dépensé</p></div>
   </div>

   {(data.fixed.confirmed.length>0||data.fixed.detected.length>0)&&<div className="mt-6 rounded-3xl border border-[var(--novae-border)] p-4 sm:p-5">
    <div className="flex flex-wrap items-end justify-between gap-2"><div><h3 className="font-[var(--novae-font-title)] text-2xl font-semibold">Charges fixes et prélèvements obligatoires</h3><p className="mt-1 text-sm text-[var(--novae-text-muted)]">Seules les charges confirmées sont sanctuarisées avant les enveloppes et objectifs.</p></div><Link href="/finances/upcoming" className="text-sm font-black text-[var(--novae-primary)]">Gérer dans À venir →</Link></div>
    {data.fixed.detected.length>0&&<div className="mt-4"><p className="text-xs font-black uppercase tracking-[.12em] text-amber-800">À confirmer</p><div className="mt-2 grid gap-2">{data.fixed.detected.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 p-4"><div><strong>{item.name}</strong><p className="text-xs text-amber-900/70">{money(Number(item.amount))} · {frequencyLabel(item.frequency)} · confiance {Math.round(Number(item.confidence||0)*100)}%</p></div><div className="flex gap-2"><button disabled={fixedBusy===item.id} onClick={()=>void fixedAction(item,'confirm_fixed')} className="rounded-full bg-[var(--novae-primary)] px-4 py-2 text-xs font-black text-white disabled:opacity-50">Confirmer obligatoire</button><button disabled={fixedBusy===item.id} onClick={()=>void fixedAction(item,'ignore')} className="rounded-full border border-amber-300 px-4 py-2 text-xs font-black disabled:opacity-50">Ignorer</button></div></div>)}</div></div>}
    {data.fixed.confirmed.length>0&&<div className="mt-4"><p className="text-xs font-black uppercase tracking-[.12em] text-emerald-800">Confirmées et réservées</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{data.fixed.confirmed.map(item=><div key={item.id} className="rounded-2xl bg-emerald-50 p-4"><strong>{item.name}</strong><p className="mt-1 text-xs text-emerald-900/70">{money(Number(item.amount))} · {frequencyLabel(item.frequency)}</p></div>)}</div></div>}
   </div>}

   <div className="mt-6 rounded-3xl border border-[var(--novae-border)] p-4 sm:p-5">
    <div className="flex flex-wrap items-end justify-between gap-2"><div><h3 className="font-[var(--novae-font-title)] text-2xl font-semibold">Répartition des dépenses</h3><p className="mt-1 text-sm text-[var(--novae-text-muted)]">{view==='cycle'?'Dépenses du cycle sélectionné.':'Dépenses cumulées sur l’année.'} Clique sur une catégorie pour voir ce qu’elle contient.</p></div><strong>{money(data.expense_total)}</strong></div>
    <div className="mt-5 grid gap-6 lg:grid-cols-[240px_1fr]">
     <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-full" style={{background:gradient}}><div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-[var(--novae-surface)] text-center shadow-sm"><span className="text-xs text-[var(--novae-text-muted)]">Dépenses</span><strong className="mt-1 text-xl">{money(data.expense_total)}</strong></div></div>
     <div className="grid content-start gap-2">{data.categories.map((c,i)=><button key={c.id} onClick={()=>setSelected(c.id)} className={`flex items-center justify-between gap-3 rounded-2xl border p-3 text-left transition ${selected===c.id?'border-[var(--novae-primary)] bg-black/[.035]':'border-[var(--novae-border)]'}`}><span className="flex min-w-0 items-center gap-3"><span className="h-3 w-3 shrink-0 rounded-full" style={{backgroundColor:palette[i%palette.length]}}/><span className="truncate font-bold">{c.name}</span></span><span className="whitespace-nowrap text-sm"><strong>{money(c.amount)}</strong> · {c.percentage}%</span></button>)}</div>
    </div>
    {active&&<div className="mt-6 rounded-2xl bg-black/[.03] p-4"><div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-[.14em] text-[var(--novae-primary)]">Détail de la catégorie</p><h4 className="mt-1 text-xl font-black">{active.name}</h4></div><p className="text-sm"><strong>{money(active.amount)}</strong> · {active.count} opération(s) · {active.percentage}%</p></div><div className="mt-3 divide-y divide-[var(--novae-border)]">{active.transactions.map(tx=><Link key={tx.id} href={`/finances/transactions/${tx.id}`} className="grid grid-cols-[82px_1fr_auto] gap-2 py-3 text-sm hover:opacity-75"><span className="text-[var(--novae-text-muted)]">{new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short'}).format(new Date(`${tx.date}T12:00:00`))}</span><span className="truncate font-semibold">{tx.label}</span><strong className="whitespace-nowrap">{money(tx.amount,tx.currency)}</strong></Link>)}</div>{active.slug==='uncategorised'&&<p className="mt-3 text-xs text-[var(--novae-text-muted)]">Ouvre une opération pour la corriger : Nova pourra ensuite retenir la règle marchand.</p>}</div>}
   </div>

   {data.insights.length>0&&<div className="mt-5 grid gap-3 md:grid-cols-2">{data.insights.map(i=>{
    const normalized=i.title.toLowerCase()
    const href=normalized.includes('récurrent')?'/finances/upcoming':normalized.includes('confirmer')||normalized.includes('catégor')?'/finances/transactions?filter=uncategorized':null
    const content=<><strong>{i.title}</strong><p className="mt-2 text-sm text-[var(--novae-text-muted)]">{i.summary}</p>{href&&<p className="mt-3 text-xs font-black text-[var(--novae-primary)]">Ouvrir et modifier →</p>}</>
    return href?<Link key={i.id} href={href} className="rounded-2xl border border-[var(--novae-border)] p-4 text-[var(--novae-text-main)] no-underline transition hover:bg-black/[.025]">{content}</Link>:<div key={i.id} className="rounded-2xl border border-[var(--novae-border)] p-4">{content}</div>
   })}</div>}
  </>}

  {message&&<div className="mt-4 rounded-2xl bg-black/[.04] p-3 text-sm">{message}</div>}
 </section>
}
