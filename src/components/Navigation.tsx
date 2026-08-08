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
  { href: '/recipes?courses=1', label: 'Courses', icon: 'cart' },
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
              onClick={(event) => {
                if (item.label === 'Courses') {
                  event.preventDefault()
                  window.location.assign('/recipes?courses=1')
                }
              }}
            >
              <span
                className={
                  item.center ? 'center-icon' : 'navigation-icon'
                }
                aria-hidden="true"
              >
                {item.center ? (
                  <span className="nova-monogram" />
                ) : (
                  <PremiumIcon
                    name={item.icon}
                    width={25}
                    height={25}
                  />
                )}
              </span>
              <span className="sr-only">{item.label}</span>
            </Link>
          )
        })}
      </div>

      <style jsx>{`
        .bottom-navigation {
          position: fixed;
          right: 18px;
          bottom: max(12px, env(safe-area-inset-bottom));
          left: 18px;
          z-index: 70;
          width: min(calc(100% - 36px), 600px);
          margin: 0 auto;
          overflow: visible;
          color: var(--novae-text-main);
          background: color-mix(
            in srgb,
            var(--novae-surface) 96%,
            transparent
          );
          border: 1px solid color-mix(
            in srgb,
            var(--novae-border) 92%,
            transparent
          );
          border-radius: 999px;
          box-shadow:
            0 14px 36px color-mix(
              in srgb,
              var(--novae-shadow) 68%,
              transparent
            );
          backdrop-filter: blur(22px);
        }

        .navigation-inner {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          align-items: center;
          width: 100%;
          min-height: 66px;
          padding: 7px 12px;
        }

        .navigation-link {
          position: relative;
          display: grid;
          min-width: 0;
          place-items: center;
          color: var(--novae-text-main);
          text-decoration: none;
        }

        .navigation-icon {
          display: inline-flex;
          width: 46px;
          height: 46px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition:
            transform 160ms ease,
            background 160ms ease,
            color 160ms ease;
        }

        .navigation-link:hover .navigation-icon {
          transform: translateY(-2px);
          background: color-mix(
            in srgb,
            var(--novae-primary-soft) 72%,
            transparent
          );
        }

        .navigation-link.active:not(.center-link) {
          color: var(--novae-metal);
        }

        .navigation-link.active:not(.center-link) .navigation-icon {
          background: color-mix(
            in srgb,
            var(--novae-primary-soft) 88%,
            transparent
          );
        }

        .center-link {
          z-index: 2;
          margin-top: -22px;
        }

        .center-icon {
          display: inline-flex;
          width: 72px;
          height: 72px;
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
          box-shadow:
            0 12px 28px var(--novae-shadow),
            inset 0 0 0 3px color-mix(
              in srgb,
              var(--novae-metal) 9%,
              transparent
            );
        }

        .nova-monogram {
          display: block;
          width: 39px;
          height: 28px;
          background: var(--novae-metal);
          -webkit-mask:
            url('/nova-monogramme-no-mask.png')
            center / contain no-repeat;
          mask:
            url('/nova-monogramme-no-mask.png')
            center / contain no-repeat;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        @media (max-width: 520px) {
          .bottom-navigation {
            right: 10px;
            bottom: max(8px, env(safe-area-inset-bottom));
            left: 10px;
            width: min(calc(100% - 20px), 520px);
          }

          .navigation-inner {
            min-height: 60px;
            padding: 6px 8px;
          }

          .navigation-icon {
            width: 42px;
            height: 42px;
          }

          .center-link {
            margin-top: -18px;
          }

          .center-icon {
            width: 66px;
            height: 66px;
          }

          .nova-monogram {
            width: 36px;
            height: 26px;
          }
        }
      `}</style>
    </nav>
  )
}
