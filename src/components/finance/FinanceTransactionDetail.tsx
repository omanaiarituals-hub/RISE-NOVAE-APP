'use client'

import { useEffect, useState } from 'react'
import FinanceBackButton from './FinanceBackButton'

type Payload = any
const natureOptions = [
  ['expense','Dépense'],['income','Revenu'],['subscription','Abonnement'],['installment','Paiement fractionné'],['refund','Remboursement'],['internal_transfer','Transfert interne'],['third_party_advance','Avance à un tiers'],['reimbursable_expense','Dépense à rembourser'],['exceptional_expense','Dépense exceptionnelle'],['cash_withdrawal','Retrait espèces'],['cash_expense','Dépense espèces'],
]

export default function FinanceTransactionDetail({ id }: { id: string }) {
  const [data, setData] = useState<Payload | null>(null)
  const [category, setCategory] = useState('')
  const [nature, setNature] = useState('expense')
  const [recurring, setRecurring] = useState(false)
  const [remember, setRemember] = useState(true)
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => { void (async () => { const r = await fetch(`/api/finance/transactions/${id}`, { cache: 'no-store' }); const p = await r.json().catch(() => ({})); if (r.ok) { setData(p); setCategory(p.annotation?.category_id || ''); setNature(p.annotation?.financial_nature || (Number(p.transaction?.amount) >= 0 ? 'income' : 'expense')); setRecurring(!!p.annotation?.is_recurring); setNote(p.annotation?.note || '') } else setStatus(p.detail || p.error || 'Impossible de charger cette opération.') })() }, [id])

  async function save() {
    setStatus('Enregistrement…')
    const r = await fetch(`/api/finance/transactions/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ category_id: category || null, financial_nature: nature, is_recurring: recurring, note, remember_rule: remember }) })
    const p = await r.json().catch(() => ({}))
    setStatus(r.ok ? (p.learned ? 'Correction enregistrée. Nova retiendra cette règle pour ce marchand.' : 'Correction enregistrée.') : (p.detail || p.error || 'Enregistrement impossible.'))
  }

  if (!data) return <div className="grid gap-4"><FinanceBackButton /><div className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-6">{status || 'Chargement…'}</div></div>
  const tx = data.transaction
  const account = Array.isArray(tx.account) ? tx.account[0] : tx.account
  return <div className="grid gap-4"><FinanceBackButton /><section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-7"><p className="text-xs font-black uppercase tracking-[.16em] text-[var(--novae-primary)]">Transaction</p><div className="mt-2 flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-[var(--novae-font-title)] text-3xl font-semibold">{tx.merchant_name || tx.raw_label || 'Opération bancaire'}</h2><p className="mt-2 text-sm text-[var(--novae-text-muted)]">{tx.transaction_date} · {account?.custom_name || account?.name || 'Compte'}</p></div><p className={`text-2xl font-black ${Number(tx.amount) >= 0 ? 'text-emerald-700' : ''}`}>{Number(tx.amount).toLocaleString('fr-FR',{style:'currency',currency:tx.currency||'EUR'})}</p></div>{data.annotation?.analysis_reason && <div className="mt-5 rounded-2xl bg-black/[.04] p-4 text-sm"><strong>Pourquoi Nova l’a classée ainsi :</strong> {data.annotation.analysis_reason}</div>}</section>
  <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-7"><h3 className="font-[var(--novae-font-title)] text-2xl font-semibold">Corriger l’analyse</h3><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-black">Catégorie<select value={category} onChange={e=>setCategory(e.target.value)} className="rounded-2xl border border-[var(--novae-border)] bg-transparent px-4 py-3 font-normal"><option value="">Aucune / transfert</option>{data.categories.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="grid gap-2 text-sm font-black">Nature financière<select value={nature} onChange={e=>setNature(e.target.value)} className="rounded-2xl border border-[var(--novae-border)] bg-transparent px-4 py-3 font-normal">{natureOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div><label className="mt-4 flex items-center gap-3 text-sm"><input type="checkbox" checked={recurring} onChange={e=>setRecurring(e.target.checked)}/><span>Cette opération est récurrente</span></label><label className="mt-3 flex items-center gap-3 text-sm"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/><span><strong>Retenir pour ce marchand</strong> — les prochaines opérations similaires seront classées pareil.</span></label><label className="mt-4 grid gap-2 text-sm font-black">Note facultative<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={500} className="min-h-24 rounded-2xl border border-[var(--novae-border)] bg-transparent px-4 py-3 font-normal"/></label><button onClick={()=>void save()} className="mt-5 rounded-full bg-[var(--novae-primary)] px-5 py-3 text-sm font-black text-white">Enregistrer la correction</button>{status&&<p className="mt-3 text-sm text-[var(--novae-text-muted)]">{status}</p>}</section></div>
}
