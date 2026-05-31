'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UNIVERS, ENCRE, ENCRE_DOUCE } from '@/lib/univers'

export default function Navigation() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + '/')

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(255,251,245,0.92)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderTop: '1px solid rgba(61,38,24,0.08)',
        boxShadow: '0 -6px 24px rgba(61,38,24,0.06)',
      }}
    >
      <div
        className="flex items-stretch gap-1.5 overflow-x-auto px-3 py-2 mx-auto"
        style={{ maxWidth: 920, scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {UNIVERS.map((u) => {
          const Icon = u.icon
          const active = isActive(u.href)
          return (
            <Link
              key={u.key}
              href={u.href}
              aria-current={active ? 'page' : undefined}
              className="flex flex-1 flex-col items-center justify-center rounded-2xl transition-all duration-200"
              style={{
                minWidth: 62,
                padding: '7px 6px',
                background: active ? u.color : 'transparent',
                boxShadow: active ? `inset 0 0 0 1.5px ${u.ink}33` : 'none',
              }}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.4 : 2}
                style={{ color: active ? ENCRE : u.ink, marginBottom: 3 }}
              />
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: active ? 700 : 500,
                  color: active ? ENCRE : ENCRE_DOUCE,
                  lineHeight: 1.1,
                  textAlign: 'center',
                  letterSpacing: '0.01em',
                }}
              >
                {u.short}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}