'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

/**
 * Header global affiché sur toutes les pages SAUF l'accueil ('/') et,
 * pour une visiteuse anonyme, SAUF /blog (contenu éditorial public — voir
 * plus bas). Sur l'accueil, c'est le composant HomeHeader qui prend le relais.
 * Affiche le bouton "Passer Premium" pour les utilisatrices en trial/expired.
 */
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
        const { data: { user } } = await supabase.auth.getUser()
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
        if (cancelled) return
        if (data) {
          setTier(data.subscription_tier || null)
          if (data.trial_ends_at && data.subscription_tier === 'trial') {
            const days = Math.ceil((new Date(data.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            setTrialDaysLeft(Math.max(0, days))
          }
        }
      } catch (err) {
        console.error('[GlobalHeader] subscription load error', err)
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    loadSubscription()
    return () => { cancelled = true }
  }, [pathname])

  // Pages où on cache complètement le header
  if (pathname === '/') return null

  // Le blog est un contenu éditorial public, pas un écran de l'app : une
  // lectrice anonyme ne doit voir aucun bandeau d'app (ni logo générique,
  // ni CTA Premium) — chaque page du blog a son propre header. Une
  // utilisatrice déjà connectée garde en revanche le header habituel,
  // Premium compris, comme sur le reste de l'app.
  const isBlog = pathname?.startsWith('/blog') ?? false
  if (isBlog && (!loaded || !isLoggedIn)) return null

  // Pages publiques : header simplifié sans CTA Premium
  const minimalPaths = ['/auth', '/onboarding', '/subscribe', '/cgu', '/privacy']
  const isMinimal = minimalPaths.some(p => pathname?.startsWith(p))

  const isPremium = tier === 'premium'
  const isTrialActive = tier === 'trial' && trialDaysLeft !== null && trialDaysLeft > 0
  const showPremiumCTA = loaded && !isMinimal && !isPremium

  return (
    <header
      style={{
        padding: '14px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(196,149,106,0.1)',
        background: 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
        <img src="/novae-logo.svg" alt="NOVAÉ" height={36} style={{ height: 36 }} />
      </Link>

      {/* CTA Premium pour trial / expired / free */}
      {showPremiumCTA && (
        <Link
          href="/subscribe"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 12,
            background: isTrialActive
              ? 'rgba(196,149,106,0.15)'
              : 'linear-gradient(135deg,#c4956a 0%,#8b5a3c 100%)',
            color: isTrialActive ? '#8b5a3c' : '#ffffff',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            fontWeight: 700,
            textDecoration: 'none',
            letterSpacing: '0.02em',
            border: isTrialActive ? '1px solid rgba(196,149,106,0.3)' : 'none',
            boxShadow: isTrialActive ? 'none' : '0 4px 12px rgba(139,90,60,0.25)',
            transition: 'all 0.2s',
          }}
        >
          <span style={{ fontSize: 10 }}>✦</span>
          <span>
            {isTrialActive
              ? `Trial · ${trialDaysLeft}j restants`
              : 'Passer Premium'}
          </span>
        </Link>
      )}

      {/* Badge Premium discret */}
      {loaded && !isMinimal && isPremium && (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          borderRadius: 999,
          background: 'linear-gradient(135deg,#c4956a 0%,#8b5a3c 100%)',
          color: '#ffffff',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.05em',
        }}>
          ✦ Premium
        </span>
      )}
    </header>
  )
}