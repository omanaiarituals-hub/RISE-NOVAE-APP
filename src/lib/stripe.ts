// src/lib/stripe.ts
// Client Stripe instancié paresseusement : la clé n'est lue qu'au moment de l'appel,
// jamais au chargement du module. Évite l'erreur "Neither apiKey..." pendant `next build`.
import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY manquante')
  _stripe = new Stripe(key, { apiVersion: '2024-06-20' as any })
  return _stripe
}