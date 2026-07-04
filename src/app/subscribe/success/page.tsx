'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'

const C = {
  brown: '#3d2618',
  brownLight: '#6b5340',
  copper: '#c4956a',
  copperDark: '#8b5a3c',
  green: '#7ba869',
}

// ⚠️ Adapte les hrefs si tes routes sont différentes
const QUICK_LINKS = [
  { emoji: '🎯', title: 'Reset 90 jours', desc: 'Démarre ta phase 1 de reprogrammation', href: '/program' },
  { emoji: '✦', title: 'Agent IA NOVAÉ', desc: 'Présente-toi à ton coach personnel', href: '/agent' },
  { emoji: '💬', title: 'Communauté', desc: 'Rejoins les autres femmes du programme', href: '/community' },
]

export default function SuccessPage() {
  const [pageLoading, setPageLoading] = useState(true)
  const [isPremium, setIsPremium] = useState(false)
  const [email, setEmail] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) setEmail(user.email)
      if (user) {
        // Poll jusqu'à 5x au cas où le webhook met du temps à arriver
        for (let i = 0; i < 5; i++) {
          const { data } = await supabase
            .from('users')
            .select('subscription_tier')
            .eq('id', user.id)
            .maybeSingle()
          if (data?.subscription_tier === 'premium') {
            setIsPremium(true)
            break
          }
          if (i < 4) await new Promise(r => setTimeout(r, 1500))
        }
      }
      setPageLoading(false)
    }
    check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background:
          'radial-gradient(ellipse at 20% 0%, #e8c4a8 0%, transparent 55%),' +
          'radial-gradient(ellipse at 80% 100%, #d4a574 0%, transparent 55%),' +
          'linear-gradient(180deg, #f3dcc6 0%, #ead0b5 50%, #e0c4a3 100%)',
      }} />

      <div style={{ minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", color: C.brown, position: 'relative', zIndex: 2 }}>

        {/* Header */}
        <div style={{
          background: 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(212,165,116,0.3)',
          padding: '14px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: C.copperDark, fontWeight: 600 }}>NOVAÉ</span>
            <span style={{ fontSize: 11, color: C.brownLight, marginLeft: 10, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Premium</span>
          </div>
        </div>

        <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 20px 80px' }}>

          {/* Hero */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{
              fontSize: 72, marginBottom: 16, lineHeight: 1,
              filter: 'drop-shadow(0 4px 12px rgba(196, 149, 106, 0.3))',
              color: C.copperDark,
            }}>
              ✦
            </div>
            <h1 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 38, color: C.brown, margin: '0 0 14px',
              fontWeight: 500, lineHeight: 1.15,
            }}>
              Bienvenue dans<br/>NOVAÉ Premium
            </h1>
            <p style={{
              color: C.brownLight, fontSize: 15, lineHeight: 1.7,
              margin: '0 auto', maxWidth: 460,
            }}>
              {pageLoading
                ? 'Activation de ton accès en cours…'
                : isPremium
                  ? 'Ton paiement est confirmé. Tu accèdes à tout, dès maintenant. ✦'
                  : "Ton paiement a été reçu. Ton accès s'active dans quelques instants, rafraîchis la page dans 30 secondes si rien ne s'affiche."}
            </p>
          </div>

          {/* Confirmation card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(123,168,105,0.18), rgba(123,168,105,0.06))',
            border: '1px solid rgba(123,168,105,0.35)',
            borderRadius: 16, padding: '18px 22px',
            marginBottom: 32, textAlign: 'center',
          }}>
            <p style={{ fontSize: 13, color: C.brown, margin: 0, lineHeight: 1.6 }}>
              ✓ Un email de confirmation Stripe avec ta facture
              {email ? <> a été envoyé à <strong>{email}</strong></> : ' a été envoyé sur ta boîte mail'}.
            </p>
          </div>

          {/* Quick links */}
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 26, color: C.brown, margin: '0 0 8px',
            fontWeight: 500, textAlign: 'center',
          }}>
            Par où commencer ?
          </h2>
          <p style={{
            fontSize: 12, color: C.brownLight,
            textAlign: 'center', marginBottom: 22, fontStyle: 'italic',
          }}>
            Tes trois prochaines portes d'entrée
          </p>

          <div style={{ display: 'grid', gap: 12, marginBottom: 32 }}>
            {QUICK_LINKS.map((link, i) => (
              <Link
                key={i}
                href={link.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '18px 20px',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.65), rgba(255,255,255,0.35))',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                  border: '1px solid rgba(255,255,255,0.6)',
                  borderRadius: 14,
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(139, 90, 60, 0.05)',
                }}
              >
                <div style={{ fontSize: 32, flexShrink: 0, lineHeight: 1 }}>{link.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.brown, marginBottom: 2 }}>
                    {link.title}
                  </div>
                  <div style={{ fontSize: 12, color: C.brownLight, lineHeight: 1.5 }}>
                    {link.desc}
                  </div>
                </div>
                <div style={{ fontSize: 18, color: C.copperDark, flexShrink: 0 }}>→</div>
              </Link>
            ))}
          </div>

          {/* Main CTA */}
          <Link
            href="/"
            style={{
              display: 'block', width: '100%',
              padding: '16px 24px', textAlign: 'center',
              background: 'linear-gradient(135deg, #c4956a, #8b5a3c)',
              color: '#fff', border: 'none', borderRadius: 12,
              fontSize: 15, fontWeight: 700, textDecoration: 'none',
              fontFamily: 'inherit',
              boxShadow: '0 6px 16px rgba(139, 90, 60, 0.25)',
              boxSizing: 'border-box',
            }}
          >
            Accéder à mon espace ✦
          </Link>

          <p style={{
            textAlign: 'center', marginTop: 28,
            fontSize: 11, color: C.brownLight, lineHeight: 1.8, opacity: 0.8,
          }}>
            Tu peux gérer ton abonnement (modification, pause, résiliation)<br/>
            à tout moment depuis tes paramètres.
          </p>

        </div>
      </div>
    </>
  )
}