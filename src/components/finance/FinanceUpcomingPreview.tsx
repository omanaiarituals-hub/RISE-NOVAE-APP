'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Item = {
  id: string
  name: string
  amount: number
  next_due_date: string | null
}

const money = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(value || 0))

export default function FinanceUpcomingPreview() {
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    void fetch('/api/finance/upcoming/preview', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => setItems(payload.items || []))
      .catch(() => setItems([]))
  }, [])

  return (
    <div className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black">À venir</p>
          <p className="mt-1 text-sm text-[var(--novae-text-muted)]">Les 3 prochains prélèvements ou charges prévues.</p>
        </div>
        <Link href="/finances/upcoming" className="text-sm font-black text-[var(--novae-primary)]">Voir tout →</Link>
      </div>

      <div className="mt-4 grid gap-2">
        {items.length ? items.map((item) => (
          <Link key={item.id} href="/finances/upcoming" className="flex items-center justify-between gap-3 rounded-2xl bg-black/[.03] p-3 hover:opacity-80">
            <div className="min-w-0">
              <strong className="block truncate">{item.name}</strong>
              <span className="text-xs text-[var(--novae-text-muted)]">
                {item.next_due_date ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(`${item.next_due_date}T12:00:00`)) : 'Date à confirmer'}
              </span>
            </div>
            <strong className="whitespace-nowrap">{money(item.amount)}</strong>
          </Link>
        )) : (
          <p className="rounded-2xl bg-black/[.03] p-3 text-sm text-[var(--novae-text-muted)]">Aucun prélèvement confirmé à venir.</p>
        )}
      </div>
    </div>
  )
}
