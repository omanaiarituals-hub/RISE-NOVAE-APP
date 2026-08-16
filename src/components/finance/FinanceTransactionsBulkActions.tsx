'use client'

import { useMemo, useState } from 'react'

type Category = { id: string; name: string }

export default function FinanceTransactionsBulkActions({
  selectedIds,
  categories,
  onDone,
}: {
  selectedIds: string[]
  categories: Category[]
  onDone: () => void
}) {
  const [categoryId, setCategoryId] = useState('')
  const [busy, setBusy] = useState(false)
  const count = selectedIds.length

  const disabled = useMemo(() => !count || !categoryId || busy, [count, categoryId, busy])

  async function apply() {
    if (disabled) return
    setBusy(true)
    const response = await fetch('/api/finance/transactions/bulk-categorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transaction_ids: selectedIds, category_id: categoryId }),
    })
    setBusy(false)
    if (response.ok) {
      setCategoryId('')
      onDone()
    }
  }

  if (!count) return null

  return (
    <div className="sticky bottom-24 z-20 mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--novae-border)] bg-[var(--novae-surface)] p-3 shadow-lg">
      <strong>{count} sélectionnée(s)</strong>
      <select
        value={categoryId}
        onChange={(event) => setCategoryId(event.target.value)}
        className="min-w-[220px] rounded-full border border-[var(--novae-border)] bg-transparent px-4 py-2 text-sm"
      >
        <option value="">Choisir une catégorie</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>{category.name}</option>
        ))}
      </select>
      <button
        disabled={disabled}
        onClick={() => void apply()}
        className="rounded-full bg-[var(--novae-primary)] px-4 py-2 text-sm font-black text-white disabled:opacity-40"
      >
        {busy ? 'Application…' : 'Catégoriser la sélection'}
      </button>
    </div>
  )
}
