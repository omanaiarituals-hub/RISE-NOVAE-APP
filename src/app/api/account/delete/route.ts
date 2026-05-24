import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { deleteBrevoContact } from '@/lib/brevo/send'

export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
})

export async function POST() {
  try {
    // 1. Vérifier l'utilisateur via cookies
    const cookieStore = await cookies()
    const userClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {},
        },
      }
    )

    const {
      data: { user },
    } = await userClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const userId = user.id
    const userEmail = user.email

    // 2. Admin client (service role) pour les opérations privilégiées
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 3. Récupérer le customer Stripe AVANT toute suppression
    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .maybeSingle()

    const stripeCustomerId = userRow?.stripe_customer_id

    // 4. Annuler l'abonnement Stripe (BLOQUANT)
    if (stripeCustomerId) {
      try {
        const subs = await stripe.subscriptions.list({
          customer: stripeCustomerId,
          status: 'all',
          limit: 100,
        })
        for (const sub of subs.data) {
          if (sub.status !== 'canceled' && sub.status !== 'incomplete_expired') {
            await stripe.subscriptions.cancel(sub.id)
            console.log('[delete-account] Stripe sub annulé:', sub.id)
          }
        }
      } catch (err: any) {
        console.error('[delete-account] Stripe cancel error:', err?.message)
        // STOP : mieux vaut un compte non supprimé qu'un abo orphelin qui facture
        return NextResponse.json({ error: 'stripe_cancel_failed' }, { status: 500 })
      }

      // 4b. Supprimer le customer Stripe (effacement RGPD, best-effort)
      try {
        await stripe.customers.del(stripeCustomerId)
        console.log('[delete-account] Stripe customer supprimé:', stripeCustomerId)
      } catch (err) {
        console.error('[delete-account] Stripe customer delete (non-blocking):', err)
      }
    }

    // 5. Supprimer le contact Brevo (best-effort, non-bloquant)
    if (userEmail) {
      try {
        await deleteBrevoContact(userEmail)
      } catch (err) {
        console.error('[delete-account] Brevo error (non-blocking):', err)
      }
    }

    // 6. Supprimer toutes les données utilisateur via RPC
    const { error: rpcError } = await supabaseAdmin.rpc('delete_user_account', {
      target_user_id: userId,
    })

    if (rpcError) {
      console.error('[delete-account] RPC error:', rpcError)
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    // 7. Supprimer l'utilisateur de auth.users (admin)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authError) {
      console.error('[delete-account] auth delete error:', authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[delete-account] error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}