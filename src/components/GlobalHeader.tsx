'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import PremiumIcon from '@/components/ui/PremiumIcon'
import NotificationBell from '@/components/NotificationBell'
import { UserMenu } from '@/components/UserMenu'
import { supabase } from '@/lib/supabase/client'

export default function GlobalHeader() {
  const pathname = usePathname()
  const [tier, setTier] = useState<string | null>(null)
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadSubscription = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user || cancelled) {
          setLoaded(true)
          return
        }

        setIsLoggedIn(true)

        const { data } = await supabase
          .from('users')
          .select('subscription_tier, trial_ends_at')
          .eq('id', user.id)
          .maybeSingle()

        if (cancelled || !data) return

        setTier(data.subscription_tier || null)

        if (data.trial_ends_at && data.subscription_tier === 'trial') {
          const days = Math.ceil(
            (new Date(data.trial_ends_at).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          )
          setTrialDaysLeft(Math.max(0, days))
        }
      } catch (error) {
        console.error('[GlobalHeader] load error', error)
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }

    void loadSubscription()

    return () => {
      cancelled = true
    }
  }, [pathname])

  if (pathname === '/') return null

  const isBlog = pathname?.startsWith('/blog') ?? false
  if (isBlog && (!loaded || !isLoggedIn)) return null

  const minimalPaths = [
    '/auth',
    '/onboarding',
    '/subscribe',
    '/cgu',
    '/confidentialite',
  ]
  const isMinimal = minimalPaths.some((path) =>
    pathname?.startsWith(path),
  )

  const isPremium = tier === 'premium'
  const isTrialActive =
    tier === 'trial' && trialDaysLeft !== null && trialDaysLeft > 0

  return (
    <header className="global-header">
      <div className="global-left">
        {!isMinimal && isLoggedIn ? <NotificationBell /> : null}
      </div>

      <Link href="/" className="global-brand" aria-label="Accueil NOVAÉ">
        <span className="official-full-logo" aria-hidden="true" />
      </Link>

      <div className="global-actions">
        {!isMinimal && (
          <>
            {!isPremium && loaded && (
              <Link
                href="/subscribe"
                className={isTrialActive ? 'premium-link trial' : 'premium-link'}
              >
                <PremiumIcon name="sparkle" width={15} height={15} />
                <span>
                  {isTrialActive
                    ? `Essai · ${trialDaysLeft} j`
                    : 'Premium'}
                </span>
              </Link>
            )}

            {isPremium && (
              <span className="premium-badge">
                <PremiumIcon name="sparkle" width={14} height={14} />
                Premium
              </span>
            )}

            {isLoggedIn ? <UserMenu /> : null}
          </>
        )}
      </div>

      <style jsx>{`
        .global-header {
          position: sticky;
          top: 0;
          z-index: 55;
          display: grid;
          min-height: 58px;
          grid-template-columns: minmax(80px, 1fr) auto minmax(80px, 1fr);
          align-items: center;
          padding: 6px 18px;
          color: var(--novae-text-main);
          background: color-mix(
            in srgb,
            var(--novae-background) 91%,
            transparent
          );
          border-bottom: 1px solid var(--novae-border);
          backdrop-filter: blur(18px);
        }

        .global-left {
          display: flex;
          min-width: 0;
          align-items: center;
          justify-content: flex-start;
        }

        .global-brand {
          display: flex;
          align-items: center;
          justify-self: center;
        }

        .official-full-logo {
          display: block;
          width: 136px;
          height: 36px;
          background: var(--novae-metal);
          -webkit-mask:
            url('/novae-logo-complet-mask.png')
            center / contain no-repeat;
          mask:
            url('/novae-logo-complet-mask.png')
            center / contain no-repeat;
        }

        @media (max-width: 520px) {
          .global-header {
            min-height: 54px;
            grid-template-columns: 52px minmax(96px, 1fr) auto;
            padding: 5px 10px;
          }

          .official-full-logo {
            width: 108px;
            height: 30px;
          }

          .premium-link,
          .premium-badge {
            padding: 6px 8px;
          }

          .premium-link span {
            display: none;
          }
        }

        .global-actions {
          display: flex;
          min-width: 0;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
        }

        .premium-link,
        .premium-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 11px;
          color: var(--novae-background);
          font-size: 10px;
          font-weight: 900;
          text-decoration: none;
          background: var(--novae-primary);
          border: 1px solid var(--novae-metal);
          border-radius: 999px;
        }

        .premium-link.trial {
          color: var(--novae-primary);
          background: var(--novae-primary-soft);
          border-color: var(--novae-border);
        }
      `}</style>
    </header>
  )
}
