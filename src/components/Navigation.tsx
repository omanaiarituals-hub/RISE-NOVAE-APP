// src/components/Navigation.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import PremiumIcon, {
  type PremiumIconName,
} from '@/components/ui/PremiumIcon'

type NavigationItem = {
  href: string
  label: string
  icon: PremiumIconName
  center?: boolean
}

const NAV_ITEMS: NavigationItem[] = [
  { href: '/', label: 'Accueil', icon: 'home' },
  { href: '/planner', label: 'Planner', icon: 'calendar' },
  { href: '/nova-v2', label: 'Nova', icon: 'sparkle', center: true },
  { href: '/recipes', label: 'Repas', icon: 'meal' },
  { href: '/profil', label: 'Moi', icon: 'user' },
]

export default function Navigation() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/'
      ? pathname === '/'
      : pathname === href || pathname?.startsWith(`${href}/`)

  return (
    <nav className="bottom-navigation" aria-label="Navigation principale">
      <div className="navigation-inner">
        {NAV_ITEMS.map((item) => {
          const active =
            item.center && pathname?.startsWith('/nova-v2')
              ? true
              : isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'navigation-link',
                active ? 'active' : '',
                item.center ? 'center-link' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-current={active ? 'page' : undefined}
            >
              <span
                className={
                  item.center ? 'center-icon' : 'navigation-icon'
                }
              >
                <PremiumIcon
                  name={item.icon}
                  width={item.center ? 27 : 23}
                  height={item.center ? 27 : 23}
                />
              </span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>

      <style jsx>{`
        .bottom-navigation {
          position: fixed;
          right: 0;
          bottom: 0;
          left: 0;
          z-index: 70;
          color: var(--novae-text-muted);
          background: color-mix(
            in srgb,
            var(--novae-surface) 94%,
            transparent
          );
          border-top: 1px solid var(--novae-border);
          box-shadow: 0 -12px 36px var(--novae-shadow);
          backdrop-filter: blur(22px);
        }

        .navigation-inner {
          display: grid;
          width: min(100%, 600px);
          grid-template-columns: repeat(5, 1fr);
          align-items: end;
          margin: 0 auto;
          padding: 7px 8px max(10px, env(safe-area-inset-bottom));
        }

        .navigation-link {
          display: flex;
          min-width: 0;
          align-items: center;
          justify-content: center;
          gap: 4px;
          color: var(--novae-text-muted);
          font-size: 10px;
          font-weight: 700;
          text-decoration: none;
          flex-direction: column;
        }

        .navigation-icon {
          display: inline-flex;
          width: 38px;
          height: 34px;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
        }

        .navigation-link.active {
          color: var(--novae-primary);
        }

        .navigation-link.active .navigation-icon {
          background: var(--novae-primary-soft);
        }

        .center-link {
          position: relative;
          margin-top: -26px;
          color: var(--novae-primary);
        }

        .center-icon {
          display: inline-flex;
          width: 61px;
          height: 61px;
          align-items: center;
          justify-content: center;
          color: var(--novae-metal);
          background: linear-gradient(
            145deg,
            var(--novae-primary),
            var(--novae-hero-end)
          );
          border: 2px solid var(--novae-metal);
          border-radius: 50%;
          box-shadow: 0 10px 26px var(--novae-shadow);
        }

        .center-link > span:last-child {
          color: var(--novae-primary);
        }

        :global(html[data-novae-preset='choice_4'])
          .center-link
          > span:last-child {
          color: var(--novae-metal);
        }
      `}</style>
    </nav>
  )
}
