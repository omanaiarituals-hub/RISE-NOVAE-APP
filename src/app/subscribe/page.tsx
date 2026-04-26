'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const PLANS = [
  {
    id: 'beta',
    name: 'Accès Bêta',
    price: '0€',
    description: 'Gratuit pendant toute la phase bêta',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BETA!,
    perks: ['Accès complet à tous les modules', 'Badge Fondatrice', 'Ton feedback intégré'],
    highlight: false,
  },
  {
    id: 'normal',
    name: 'NOVAÉ Premium',
    price: '7,99€/mois',
    description: 'Tarif standard après lancement',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_NORMAL!,
    perks: ['Accès complet', 'Agent IA NOVAÉ', 'Programme 90 jours', 'Communauté'],
    highlight: true,
  },
  {
    id: 'attente',
    name: 'Offre Lancement',
    price: '6,90€/mois',
    description: "Offre exclusive liste d'attente -20%",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ATTENTE!,
    perks: ['Accès complet', 'Tarif préférentiel à vie', 'Accès prioritaire'],
    highlight: false,
  },
]

export default function SubscribePage() {
  const [loading, setLoading] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleSubscribe(plan: typeof PLANS[0]) {
    setLoading(plan.id)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: plan.priceId,
          email: user?.email,
        }),
      })

      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (e) {
      console.error(e)
      setLoading(null)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0a0d',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      fontFamily: 'sans-serif',
    }}>
      <p style={{ color: '#C4956A', letterSpacing: 4, fontSize: 11, marginBottom: 16 }}>✦ CHOISIR TON ACCÈS</p>
      <h1 style={{ color: 'white', fontFamily: 'serif', fontSize: 40, marginBottom: 8, textAlign: 'center' }}>
        NOVAÉ Premium
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 48, fontSize: 14 }}>
        Accès complet · Sans engagement
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, maxWidth: 900, width: '100%' }}>
        {PLANS.map(plan => (
          <div key={plan.id} style={{
            background: plan.highlight ? '#C4956A' : 'rgba(255,255,255,0.04)',
            border: plan.highlight ? 'none' : '1px solid rgba(196,149,106,0.2)',
            borderRadius: 8,
            padding: '36px 28px',
            position: 'relative',
          }}>
            {plan.highlight && (
              <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#5C1A2E', color: '#C4956A', fontSize: 10, padding: '4px 16px', borderRadius: 20, letterSpacing: 2, whiteSpace: 'nowrap' }}>
                ✦ RECOMMANDÉ
              </div>
            )}
            <h3 style={{ color: plan.highlight ? '#3A0D1C' : '#C4956A', fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>
              {plan.name}
            </h3>
            <div style={{ color: plan.highlight ? '#3A0D1C' : 'white', fontSize: 36, fontWeight: 700, marginBottom: 8 }}>
              {plan.price}
            </div>
            <p style={{ color: plan.highlight ? 'rgba(58,13,28,0.7)' : 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 24 }}>
              {plan.description}
            </p>
            {plan.perks.map(perk => (
              <div key={perk} style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: 13, color: plan.highlight ? '#3A0D1C' : 'rgba(255,255,255,0.7)' }}>
                <span>✓</span><span>{perk}</span>
              </div>
            ))}
            <button
              onClick={() => handleSubscribe(plan)}
              disabled={loading === plan.id}
              style={{
                width: '100%',
                marginTop: 24,
                padding: '14px',
                background: plan.highlight ? '#3A0D1C' : '#C4956A',
                color: plan.highlight ? '#C4956A' : '#3A0D1C',
                border: 'none',
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: loading === plan.id ? 'wait' : 'pointer',
                letterSpacing: 1,
              }}
            >
              {loading === plan.id ? 'Chargement...' : 'Choisir ce plan →'}
            </button>
          </div>
        ))}
      </div>

      <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 32 }}>
        🔒 Paiement sécurisé par Stripe · Sans engagement · Résiliation en 1 clic
      </p>
    </div>
  )
}