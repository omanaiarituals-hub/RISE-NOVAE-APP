'use client'

import { useRouter } from 'next/navigation'

export default function FinanceBackButton() {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back()
        else router.push('/finances')
      }}
      className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-xs font-bold text-[var(--novae-text-muted)] hover:text-[var(--novae-text-main)]"
      aria-label="Revenir à la page précédente"
    >
      <span aria-hidden="true">←</span>
      Retour
    </button>
  )
}
