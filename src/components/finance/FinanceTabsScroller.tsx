'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

export type FinanceTabItem = {
  href: string
  label: string
}

export default function FinanceTabsScroller({ items }: { items: FinanceTabItem[] }) {
  const pathname = usePathname()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const updateArrows = useCallback(() => {
    const node = scrollerRef.current
    if (!node) return
    const max = Math.max(0, node.scrollWidth - node.clientWidth)
    setCanLeft(node.scrollLeft > 4)
    setCanRight(node.scrollLeft < max - 4)
  }, [])

  useEffect(() => {
    const node = scrollerRef.current
    if (!node) return

    updateArrows()
    const resize = new ResizeObserver(updateArrows)
    resize.observe(node)
    node.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)

    return () => {
      resize.disconnect()
      node.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
  }, [updateArrows])

  useEffect(() => {
    const node = scrollerRef.current
    if (!node) return
    const active = node.querySelector<HTMLElement>('[data-finance-active="true"]')
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    const timer = window.setTimeout(updateArrows, 250)
    return () => window.clearTimeout(timer)
  }, [pathname, updateArrows])

  function move(direction: -1 | 1) {
    const node = scrollerRef.current
    if (!node) return
    node.scrollBy({ left: direction * Math.max(180, node.clientWidth * 0.72), behavior: 'smooth' })
  }

  return (
    <div className="relative mb-6">
      {canLeft ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-12 items-center bg-gradient-to-r from-[var(--novae-background)] via-[var(--novae-background)]/95 to-transparent sm:w-14">
          <button
            type="button"
            aria-label="Voir les onglets précédents"
            onClick={() => move(-1)}
            className="pointer-events-auto ml-0.5 grid h-9 w-9 place-items-center rounded-full border border-[var(--novae-border)] bg-[var(--novae-surface)] text-xl font-black shadow-sm transition hover:-translate-y-0.5"
          >
            ‹
          </button>
        </div>
      ) : null}

      <div
        ref={scrollerRef}
        aria-label="Navigation Finance"
        className="flex gap-2 overflow-x-auto scroll-smooth px-0.5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const active = item.href === '/finances' ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              data-finance-active={active ? 'true' : 'false'}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold no-underline transition hover:-translate-y-0.5 ${
                active
                  ? 'border-[var(--novae-primary)] bg-[var(--novae-primary)] text-white'
                  : 'border-[var(--novae-border)] bg-[var(--novae-surface)] text-[var(--novae-text-main)]'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>

      {canRight ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-12 items-center justify-end bg-gradient-to-l from-[var(--novae-background)] via-[var(--novae-background)]/95 to-transparent sm:w-14">
          <button
            type="button"
            aria-label="Voir les onglets suivants"
            onClick={() => move(1)}
            className="pointer-events-auto mr-0.5 grid h-9 w-9 place-items-center rounded-full border border-[var(--novae-border)] bg-[var(--novae-surface)] text-xl font-black shadow-sm transition hover:-translate-y-0.5"
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  )
}
