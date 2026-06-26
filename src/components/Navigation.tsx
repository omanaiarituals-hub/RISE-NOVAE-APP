'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/',        label: 'Accueil', emoji: '🏠' },
  { href: '/program', label: 'Reset',   emoji: '🎯' },
  { href: '/agent',   label: 'Nova',    emoji: '✦',  center: true },
  { href: '/tracker', label: 'Suivi',   emoji: '📊' },
  { href: '/profil',  label: 'Moi',     emoji: '👤' },
]

export default function Navigation() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname?.startsWith(href + '/')

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      background: 'rgba(255,251,245,0.96)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(61,38,24,0.08)',
      boxShadow: '0 -4px 20px rgba(61,38,24,0.07)',
    }}>
      <div style={{
        maxWidth: 500, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '6px 8px 10px',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
      }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)

          if (item.center) {
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #c4956a, #b07d5a 55%, #c98b86)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 18px rgba(196,149,106,0.5)',
                  marginTop: -18,
                  fontSize: 22, color: '#fff',
                  fontFamily: "'Cormorant Garamond', serif",
                }}>
                  {item.emoji}
                </div>
                <span style={{ fontSize: 9.5, fontWeight: 600, color: '#b07d5a', letterSpacing: '0.04em' }}>
                  {item.label}
                </span>
              </Link>
            )
          }

          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
                background: active ? 'rgba(196,149,106,0.15)' : 'transparent',
                transition: 'background 0.15s',
              }}>
                {item.emoji}
              </div>
              <span style={{
                fontSize: 9.5, fontWeight: active ? 700 : 500,
                color: active ? '#b07d5a' : '#8b6f55',
                letterSpacing: '0.03em',
              }}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}