'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const C = {
  cream: '#f3dcc6',
  brown: '#3d2618',
  brownLight: '#6b5340',
  copper: '#c4956a',
  copperDark: '#8b5a3c',
  green: '#7ba869',
}

const LAUNCH_CUTOFF = new Date('2026-06-01T00:00:00Z')

// ⚠️ Remplace ces valeurs par tes vrais IDs Stripe
// (Stripe Dashboard → Catalogue de produits → copier l'ID price_xxx)
const PRICE_ID_PREMIUM = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PREMIUM || 'price_REMPLACE_MOI'

const PREMIUM_FEATURES = [
  { emoji: '🎯', title: 'Programme 90 jours adaptatif', desc: '3 phases, des missions qui évoluent avec toi' },
  { emoji: '✦', title: 'Agent IA NOVAÉ illimité', desc: 'Ton coach personnel qui te connaît et s\'adapte' },
  { emoji: '📸', title: 'Scan recettes IA + Routines IA', desc: 'Photographie un plat → recette générée. Routines selon ton énergie' },
  { emoji: '👨‍👩‍👧', title: 'Famille intelligente', desc: 'Détection automatique des conflits & allergies pour tes proches' },
  { emoji: '🏆', title: 'Défis, badges & Astuces', desc: 'Participe, gagne tes badges, débloque les conseils ciblés' },
  { emoji: '💬', title: 'Communauté complète', desc: 'Poste, commente, échange avec les autres femmes du programme' },
  { emoji: '📈', title: 'Bilans hebdo IA', desc: 'Ton tableau de bord personnel chaque dimanche, écrit par ton IA' },
  { emoji: '🌙', title: 'Cercle de la semaine', desc: 'Mise en lumière communautaire de 3 à 5 femmes inspirantes' },
]

type ComparisonRow = {
  label: string
  free?: string
  premium?: string
  isHeader?: boolean
}

const COMPARISON: ComparisonRow[] = [
  { label: 'Tracker (poids, humeur, eau)', free: '✓', premium: '✓' },
  { label: 'Planner & To-do', free: '✓', premium: '✓' },
  { label: 'Notes personnelles', free: '✓', premium: '✓' },
  { label: 'Routines de base', free: '✓', premium: '✓' },
  { label: 'Recettes ajoutées manuellement', free: '✓', premium: '✓' },
  { label: 'Famille — saisie membres', free: '✓', premium: '✓' },
  { label: 'Communauté — lecture & likes', free: '✓', premium: '✓' },
  { label: 'Réservé Premium', isHeader: true },
  { label: 'Programme 90 jours adaptatif', free: '🔒', premium: '✓' },
  { label: 'Agent IA NOVAÉ (coach personnel)', free: '🔒', premium: '✓' },
  { label: 'Scan recettes par IA', free: '🔒', premium: '✓' },
  { label: 'Routines IA personnalisées', free: '🔒', premium: '✓' },
  { label: 'Famille — détection conflits/allergies', free: '🔒', premium: '✓' },
  { label: 'Défis — participer & gagner badges', free: '👁️', premium: '✓' },
  { label: 'Astuces — contenu', free: '👁️', premium: '✓' },
  { label: 'Communauté — poster, commenter', free: '🔒', premium: '✓' },
  { label: 'Bilans hebdo IA', free: '🔒', premium: '✓' },
  { label: 'Cercle de la semaine', free: '🔒', premium: '✓' },
]

export default function SubscribePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userData, setUserData] = useState<{
    subscription_tier?: string
    trial_ends_at?: string
  } | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('subscription_tier, trial_ends_at')
          .eq('id', user.id)
          .maybeSingle()
        setUserData(data)
      }
      setPageLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubscribe(priceId: string) {
    if (!user) {
      router.push('/auth?redirect=/subscribe')
      return
    }
    setLoading(true)
    try {
      // Récupère le token de session pour authentifier la route API
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ priceId }),
      })

      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (e) {
      console.error('[subscribe] checkout error:', e)
      setLoading(false)
    }
  }

  const now = new Date()
  const isAvantPremiere = now < LAUNCH_CUTOFF
  const isPremium = userData?.subscription_tier === 'premium'
  const isInTrial =
    userData?.subscription_tier === 'trial' &&
    userData?.trial_ends_at &&
    new Date(userData.trial_ends_at) > now

  const trialEndsDate = userData?.trial_ends_at
    ? new Date(userData.trial_ends_at)
    : null
  const trialEndsFormatted = trialEndsDate
    ? trialEndsDate.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

  let statusText = ''
  if (isPremium) statusText = '✦ Tu es déjà Premium'
  else if (isInTrial && isAvantPremiere)
    statusText = `✨ Avant-première gratuite jusqu'au ${trialEndsFormatted}`
  else if (isInTrial)
    statusText = `✨ Essai gratuit jusqu'au ${trialEndsFormatted}`
  else if (isAvantPremiere)
    statusText = `✨ Avant-première gratuite jusqu'au 1er juin 2026`
  else statusText = `✨ 14 jours d'essai gratuit`

  let ctaText = 'Commencer maintenant →'
  if (isPremium) ctaText = "Retour à l'app ✦"
  else if (isInTrial) ctaText = "Souscrire pour continuer après l'essai →"

  if (pageLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: C.cream,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p
          style={{
            color: C.brownLight,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
          }}
        >
          Chargement…
        </p>
      </div>
    )
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          background:
            'radial-gradient(ellipse at 20% 0%, #e8c4a8 0%, transparent 55%),' +
            'radial-gradient(ellipse at 80% 100%, #d4a574 0%, transparent 55%),' +
            'linear-gradient(180deg, #f3dcc6 0%, #ead0b5 50%, #e0c4a3 100%)',
        }}
      />

      <div
        style={{
          minHeight: '100vh',
          fontFamily: "'DM Sans', sans-serif",
          color: C.brown,
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            borderBottom: '1px solid rgba(212,165,116,0.3)',
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div>
            <span
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 22,
                color: C.copperDark,
                fontWeight: 600,
              }}
            >
              NOVAÉ
            </span>
            <span
              style={{
                fontSize: 11,
                color: C.brownLight,
                marginLeft: 10,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}
            >
              Premium
            </span>
          </div>
          <Link
            href="/"
            style={{
              background: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(212,165,116,0.3)',
              borderRadius: 8,
              padding: '6px 12px',
              color: C.brownLight,
              fontSize: 12,
              textDecoration: 'none',
            }}
          >
            ← Retour
          </Link>
        </div>

        <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 80px' }}>

          {/* Hero */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <p
              style={{
                color: C.copperDark,
                letterSpacing: '0.25em',
                fontSize: 11,
                marginBottom: 14,
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              ✦ Accès Premium
            </p>
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 42,
                color: C.brown,
                margin: '0 0 10px',
                fontWeight: 500,
                lineHeight: 1.1,
              }}
            >
              NOVAÉ Premium
            </h1>
            <p
              style={{
                color: C.brownLight,
                fontSize: 16,
                lineHeight: 1.6,
                margin: '0 auto',
                maxWidth: 440,
                fontStyle: 'italic',
              }}
            >
              Ne plus survivre. Vivre.
            </p>
          </div>

          {/* Status pill */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <span
              style={{
                display: 'inline-block',
                padding: '8px 20px',
                background: isPremium
                  ? 'linear-gradient(135deg, rgba(123,168,105,0.18), rgba(123,168,105,0.08))'
                  : 'linear-gradient(135deg, rgba(196,149,106,0.22), rgba(196,149,106,0.08))',
                border: `1px solid ${
                  isPremium ? 'rgba(123,168,105,0.4)' : 'rgba(196,149,106,0.4)'
                }`,
                borderRadius: 24,
                fontSize: 12,
                fontWeight: 600,
                color: isPremium ? C.green : C.copperDark,
                letterSpacing: '0.05em',
              }}
            >
              {statusText}
            </span>
          </div>

          {/* Price card */}
          <div
            style={{
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.4))',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid rgba(196,149,106,0.3)',
              borderRadius: 20,
              padding: '36px 28px',
              textAlign: 'center',
              marginBottom: 24,
              boxShadow: '0 10px 30px rgba(139, 90, 60, 0.08)',
            }}
          >
            <div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 64,
                fontWeight: 500,
                color: C.copperDark,
                lineHeight: 1,
                marginBottom: 4,
              }}
            >
              7,90€
            </div>
            <div style={{ color: C.brownLight, fontSize: 13, marginBottom: 20 }}>
              par mois · sans engagement
            </div>

            <div
              style={{
                height: 1,
                background: 'rgba(212,165,116,0.25)',
                margin: '20px auto',
                maxWidth: 200,
              }}
            />

            <p
              style={{
                fontSize: 13,
                color: C.brownLight,
                lineHeight: 1.65,
                marginBottom: 24,
                maxWidth: 420,
                margin: '0 auto 24px',
              }}
            >
              {isPremium
                ? 'Tu profites déjà de tous les modules sans limite. Merci ✦'
                : isInTrial
                ? `Tu profites actuellement de l'accès complet gratuit jusqu'au ${trialEndsFormatted}. Tu peux souscrire dès maintenant pour basculer en Premium sans interruption.`
                : isAvantPremiere
                ? "Pendant l'avant-première, tu accèdes à tout gratuitement. Souscrire maintenant te garantit la continuité Premium après le 1er juin."
                : "Bénéficie de 14 jours d'essai gratuit. Aucun engagement, résiliable à tout moment."}
            </p>

            {isPremium ? (
              <Link
                href="/"
                style={{
                  display: 'inline-block',
                  width: '100%',
                  maxWidth: 320,
                  padding: '14px 24px',
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #7ba869, #5d8c4e)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: 'none',
                  fontFamily: 'inherit',
                  boxShadow: '0 6px 16px rgba(123, 168, 105, 0.25)',
                  boxSizing: 'border-box',
                }}
              >
                {ctaText}
              </Link>
            ) : (
              <button
                onClick={() => handleSubscribe(PRICE_ID_PREMIUM)}
                disabled={loading}
                style={{
                  width: '100%',
                  maxWidth: 320,
                  padding: '14px 24px',
                  background: loading
                    ? 'rgba(196,149,106,0.4)'
                    : 'linear-gradient(135deg, #c4956a, #8b5a3c)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: loading ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 6px 16px rgba(139, 90, 60, 0.25)',
                }}
              >
                {loading ? 'Redirection vers Stripe…' : ctaText}
              </button>
            )}

            <p
              style={{
                fontSize: 11,
                color: C.brownLight,
                marginTop: 14,
                opacity: 0.7,
              }}
            >
              🔒 Paiement sécurisé · Stripe
            </p>
          </div>

          {/* Premium features */}
          <div
            style={{
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0.25))',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid rgba(255,255,255,0.5)',
              borderRadius: 20,
              padding: '28px 24px',
              marginBottom: 24,
            }}
          >
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 24,
                color: C.brown,
                margin: '0 0 18px',
                fontWeight: 500,
                textAlign: 'center',
              }}
            >
              Ce que tu débloques
            </h2>
            <div style={{ display: 'grid', gap: 14 }}>
              {PREMIUM_FEATURES.map((feat, i) => (
                <div
                  key={i}
                  style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}
                >
                  <div
                    style={{
                      fontSize: 24,
                      flexShrink: 0,
                      lineHeight: 1,
                      marginTop: 2,
                    }}
                  >
                    {feat.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: C.brown,
                        marginBottom: 2,
                      }}
                    >
                      {feat.title}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: C.brownLight,
                        lineHeight: 1.5,
                      }}
                    >
                      {feat.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comparison */}
          <div
            style={{
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0.25))',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid rgba(255,255,255,0.5)',
              borderRadius: 20,
              padding: '28px 24px',
              marginBottom: 24,
            }}
          >
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 24,
                color: C.brown,
                margin: '0 0 6px',
                fontWeight: 500,
                textAlign: 'center',
              }}
            >
              Free vs Premium
            </h2>
            <p
              style={{
                fontSize: 12,
                color: C.brownLight,
                textAlign: 'center',
                marginBottom: 18,
                fontStyle: 'italic',
              }}
            >
              Tout ce qui change selon ton plan
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 60px 60px',
                padding: '8px 0',
                fontSize: 10,
                fontWeight: 700,
                color: C.brownLight,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              <div>Module</div>
              <div style={{ textAlign: 'center' }}>Free</div>
              <div style={{ textAlign: 'center', color: C.copperDark }}>
                Premium
              </div>
            </div>

            {COMPARISON.map((row, i) => {
              if (row.isHeader) {
                return (
                  <div
                    key={i}
                    style={{
                      padding: '14px 0 6px',
                      fontSize: 10,
                      fontWeight: 700,
                      color: C.copperDark,
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      borderTop: '1px solid rgba(212,165,116,0.3)',
                      marginTop: 6,
                      textAlign: 'center',
                    }}
                  >
                    Réservé Premium ↓
                  </div>
                )
              }
              return (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) 60px 60px',
                    padding: '10px 0',
                    borderTop: '1px solid rgba(212,165,116,0.12)',
                    fontSize: 12,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ color: C.brown }}>{row.label}</div>
                  <div
                    style={{
                      textAlign: 'center',
                      fontWeight: 600,
                      color:
                        row.free === '✓'
                          ? C.green
                          : row.free === '🔒'
                          ? C.brownLight
                          : C.copperDark,
                    }}
                  >
                    {row.free}
                  </div>
                  <div
                    style={{
                      textAlign: 'center',
                      fontWeight: 600,
                      color: C.green,
                    }}
                  >
                    {row.premium || ''}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Trust */}
          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <p
              style={{
                fontSize: 12,
                color: C.brownLight,
                lineHeight: 1.8,
                opacity: 0.8,
              }}
            >
              ✦ Sans engagement · Résiliable à tout moment depuis tes
              paramètres
              <br />
              🔒 Paiement sécurisé par Stripe · Tes informations bancaires ne
              sont jamais stockées par NOVAÉ
            </p>
          </div>
        </div>
      </div>
    </>
  )
}