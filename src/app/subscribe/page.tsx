'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function SubscribePage() {
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleSubscribe() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_NORMAL,
          email: user?.email,
        }),
      })

      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (e) {
      console.error(e)
      setLoading(false)
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
      textAlign: 'center',
    }}>
      <p style={{ color: '#C4956A', letterSpacing: 4, fontSize: 11, marginBottom: 16 }}>✦ ACCÈS PREMIUM</p>
      <h1 style={{ color: 'white', fontFamily: 'serif', fontSize: 42, marginBottom: 8 }}>
        NOVAÉ Premium
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 48, fontSize: 14 }}>
        Accès complet · Sans engagement · Résiliable à tout moment
      </p>

      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(196,149,106,0.3)',
        borderRadius: 12,
        padding: '48px 44px',
        maxWidth: 420,
        width: '100%',
      }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ color: '#C4956A', fontSize: 56, fontWeight: 700, lineHeight: 1 }}>
            7,99€
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4 }}>
            par mois
          </div>
        </div>

        {[
          'Programme 90 jours personnalisé',
          'Agent IA NOVAÉ (coach personnel)',
          'Planner, Routines & Tracker',
          'Recettes & Liste de courses auto',
          'Famille & détection allergies',
          'Communauté NOVAÉ',
        ].map(perk => (
          <div key={perk} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 14,
            fontSize: 14,
            color: 'rgba(255,255,255,0.7)',
            textAlign: 'left',
          }}>
            <span style={{ color: '#C4956A', fontSize: 16 }}>✓</span>
            <span>{perk}</span>
          </div>
        ))}

        <button
          onClick={handleSubscribe}
          disabled={loading}
          style={{
            width: '100%',
            marginTop: 32,
            padding: '16px',
            background: '#C4956A',
            color: '#3A0D1C',
            border: 'none',
            borderRadius: 6,
            fontSize: 15,
            fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Chargement...' : "S'abonner maintenant →"}
        </button>

        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 16 }}>
          🔒 Paiement sécurisé par Stripe · Sans engagement
        </p>
      </div>
    </div>
  )
}