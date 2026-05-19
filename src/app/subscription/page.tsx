'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

type SubscriptionTier = 'free' | 'trial' | 'premium' | 'expired'

interface UserSubscription {
  email: string
  tier: SubscriptionTier
  trialEndsAt: string | null
  stripeCustomerId: string | null
}

interface Plan {
  id: string
  name: string
  price: string
  period: string
  description: string
  features: string[]
  matchesTier: SubscriptionTier[]
  highlight: boolean
}

const PLANS: Plan[] = [
  {
    id: 'premium_monthly',
    name: 'Premium Mensuel',
    price: '7,90€',
    period: 'par mois',
    description: 'Accès illimité à tous les modules. Sans engagement.',
    features: [
      'Agent IA illimité',
      'Programme 90 jours complet',
      'Scan recettes par IA',
      'Bilan hebdomadaire personnalisé',
      'Astuces détaillées et Cercle de la semaine',
      'Détection des conflits Famille',
    ],
    matchesTier: ['premium', 'trial'],
    highlight: true,
  },
  // Futures formules : Premium Annuel, Family, etc.
]

export default function SubscriptionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [sub, setSub] = useState<UserSubscription | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth')
        return
      }
      const { data: user, error } = await supabase
        .from('users')
        .select('email, subscription_tier, trial_ends_at, stripe_customer_id')
        .eq('id', session.user.id)
        .single()

      if (!error && user) {
        setSub({
          email: user.email,
          tier: (user.subscription_tier as SubscriptionTier) ?? 'free',
          trialEndsAt: user.trial_ends_at,
          stripeCustomerId: user.stripe_customer_id,
        })
      }
      setLoading(false)
    }
    load()
  }, [router])

  const trialDaysLeft = sub?.trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(sub.trialEndsAt).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0

  const handleManageBilling = async () => {
    setPortalLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth')
        return
      }
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        alert('Impossible d ouvrir le portail de gestion pour le moment.')
        return
      }
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (e) {
      console.error(e)
      alert('Une erreur est survenue. Réessaie dans un instant.')
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdf8f1]">
        <div className="text-[#8b5a3c] font-light tracking-wide">
          Chargement...
        </div>
      </div>
    )
  }

  if (!sub) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdf8f1]">
        <div className="text-[#8b5a3c] font-light">
          Impossible de charger ton abonnement.
        </div>
      </div>
    )
  }

  const statusBlock = renderStatusBlock(sub, trialDaysLeft, handleManageBilling, portalLoading)

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fdf8f1] via-[#f7e9d7] to-[#e8cfb0]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 max-w-4xl mx-auto">
        <Link href="/" className="flex items-baseline gap-3">
          <span
            className="text-2xl text-[#3d2817] tracking-[0.18em]"
            style={{ fontFamily: 'Cormorant Garamond, serif' }}
          >
            NOVAÉ
          </span>
          <span className="text-xs text-[#8b5a3c] tracking-[0.25em] uppercase">
            Abonnement
          </span>
        </Link>
        <Link
          href="/"
          className="text-sm text-[#8b5a3c] border border-[#c4956a]/40 rounded-full px-4 py-1.5 hover:bg-white/40 transition"
        >
          Retour à l app
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 pb-20">
        {/* Status block */}
        <section className="mt-6">
          <h1
            className="text-3xl text-[#3d2817] text-center mb-2"
            style={{ fontFamily: 'Cormorant Garamond, serif' }}
          >
            Mon abonnement
          </h1>
          <p className="text-center text-sm text-[#8b5a3c]/80 mb-8">
            {sub.email}
          </p>
          {statusBlock}
        </section>

        {/* Plans */}
        <section className="mt-12">
          <h2
            className="text-2xl text-[#3d2817] text-center mb-6"
            style={{ fontFamily: 'Cormorant Garamond, serif' }}
          >
            Formules disponibles
          </h2>

          <div className="grid gap-5">
            {PLANS.map((plan) => {
              const isCurrent = plan.matchesTier.includes(sub.tier)
              return (
                <div
                  key={plan.id}
                  className={`rounded-3xl p-7 backdrop-blur-sm ${
                    isCurrent
                      ? 'bg-gradient-to-br from-[#fdf8f1] to-[#f5e3cc] border-2 border-[#c4956a]'
                      : 'bg-white/60 border border-[#c4956a]/20'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3
                        className="text-2xl text-[#3d2817]"
                        style={{ fontFamily: 'Cormorant Garamond, serif' }}
                      >
                        {plan.name}
                      </h3>
                      <p className="text-sm text-[#8b5a3c]/80 mt-1">
                        {plan.description}
                      </p>
                    </div>
                    {isCurrent && (
                      <span className="text-xs text-[#8b5a3c] bg-white/70 rounded-full px-3 py-1 border border-[#c4956a]/40 whitespace-nowrap">
                        ✦ Formule actuelle
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-2 mb-5">
                    <span
                      className="text-4xl text-[#8b5a3c]"
                      style={{ fontFamily: 'Cormorant Garamond, serif' }}
                    >
                      {plan.price}
                    </span>
                    <span className="text-sm text-[#8b5a3c]/70">
                      {plan.period}
                    </span>
                  </div>

                  <ul className="space-y-2 mb-6">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="text-sm text-[#3d2817]/80 flex items-start gap-2"
                      >
                        <span className="text-[#c4956a] mt-0.5">✦</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {!isCurrent && (
                    <Link
                      href="/subscribe"
                      className="block w-full text-center bg-gradient-to-r from-[#c4956a] to-[#8b5a3c] text-white rounded-full py-3 font-medium tracking-wide hover:opacity-90 transition"
                    >
                      Choisir cette formule ✦
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Footer note */}
        <p className="text-center text-xs text-[#8b5a3c]/60 mt-10 leading-relaxed">
          Paiement sécurisé par Stripe. Résiliation possible à tout moment depuis
          le portail de gestion.
        </p>
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Status block per tier                                              */
/* ------------------------------------------------------------------ */

function renderStatusBlock(
  sub: UserSubscription,
  trialDaysLeft: number,
  onManage: () => void,
  portalLoading: boolean
) {
  if (sub.tier === 'premium') {
    return (
      <div className="rounded-3xl bg-gradient-to-br from-[#fdf8f1] to-[#f0d9b8] border-2 border-[#c4956a] p-7 text-center">
        <div className="text-xs text-[#8b5a3c] tracking-[0.25em] uppercase mb-3">
          ✦ Premium actif
        </div>
        <p
          className="text-2xl text-[#3d2817] mb-2"
          style={{ fontFamily: 'Cormorant Garamond, serif' }}
        >
          Tu profites de tous les modules sans limite.
        </p>
        <p className="text-sm text-[#8b5a3c]/80 mb-6">
          Merci de faire partie de l aventure NOVAÉ ✦
        </p>
        <button
          onClick={onManage}
          disabled={portalLoading}
          className="bg-white/70 text-[#8b5a3c] border border-[#c4956a]/40 rounded-full px-6 py-2.5 text-sm font-medium hover:bg-white transition disabled:opacity-50"
        >
          {portalLoading ? 'Ouverture...' : 'Gérer mon abonnement'}
        </button>
      </div>
    )
  }

  if (sub.tier === 'trial') {
    return (
      <div className="rounded-3xl bg-white/60 border border-[#c4956a]/30 p-7 text-center">
        <div className="text-xs text-[#8b5a3c] tracking-[0.25em] uppercase mb-3">
          ✦ Essai en cours
        </div>
        <p
          className="text-2xl text-[#3d2817] mb-2"
          style={{ fontFamily: 'Cormorant Garamond, serif' }}
        >
          {trialDaysLeft > 0
            ? `${trialDaysLeft} jour${trialDaysLeft > 1 ? 's' : ''} restant${
                trialDaysLeft > 1 ? 's' : ''
              } dans ton essai`
            : 'Ton essai se termine aujourd hui'}
        </p>
        <p className="text-sm text-[#8b5a3c]/80 mb-6">
          Continue ton parcours sans interruption en passant Premium.
        </p>
        <Link
          href="/subscribe"
          className="inline-block bg-gradient-to-r from-[#c4956a] to-[#8b5a3c] text-white rounded-full px-7 py-3 font-medium tracking-wide hover:opacity-90 transition"
        >
          Passer Premium ✦
        </Link>
      </div>
    )
  }

  if (sub.tier === 'expired') {
    return (
      <div className="rounded-3xl bg-white/60 border border-[#c4956a]/30 p-7 text-center">
        <div className="text-xs text-[#8b5a3c] tracking-[0.25em] uppercase mb-3">
          ✦ Abonnement expiré
        </div>
        <p
          className="text-2xl text-[#3d2817] mb-2"
          style={{ fontFamily: 'Cormorant Garamond, serif' }}
        >
          Tu as accès aux modules gratuits.
        </p>
        <p className="text-sm text-[#8b5a3c]/80 mb-6">
          Reprends Premium quand tu es prête. Tes données sont conservées.
        </p>
        <Link
          href="/subscribe"
          className="inline-block bg-gradient-to-r from-[#c4956a] to-[#8b5a3c] text-white rounded-full px-7 py-3 font-medium tracking-wide hover:opacity-90 transition"
        >
          Reprendre Premium ✦
        </Link>
      </div>
    )
  }

  // Free
  return (
    <div className="rounded-3xl bg-white/60 border border-[#c4956a]/30 p-7 text-center">
      <div className="text-xs text-[#8b5a3c] tracking-[0.25em] uppercase mb-3">
        Accès gratuit
      </div>
      <p
        className="text-2xl text-[#3d2817] mb-2"
        style={{ fontFamily: 'Cormorant Garamond, serif' }}
      >
        Tu profites des modules essentiels.
      </p>
      <p className="text-sm text-[#8b5a3c]/80 mb-6">
        Débloque l Agent IA, le Programme 90 jours et bien plus en passant Premium.
      </p>
      <Link
        href="/subscribe"
        className="inline-block bg-gradient-to-r from-[#c4956a] to-[#8b5a3c] text-white rounded-full px-7 py-3 font-medium tracking-wide hover:opacity-90 transition"
      >
        Devenir Premium ✦
      </Link>
    </div>
  )
}