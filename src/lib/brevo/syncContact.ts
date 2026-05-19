const BREVO_API_KEY = process.env.BREVO_API_KEY
const BREVO_LIST_MEMBRES = 9 // NOVAÉ - Membres

interface BrevoSyncInput {
  email: string
  prenom?: string | null
}

/**
 * Ajoute (ou met à jour) un contact dans Brevo et l'inscrit à la liste #9 NOVAÉ - Membres.
 * Déclenche automatiquement les automatisations welcome series (J0 → J+7, J+11, J+14, J+15, J+30).
 *
 * Conçu pour être appelé après que l'onboarding est terminé.
 * En cas d'erreur Brevo, ne bloque pas le flow (silent fail + log).
 */
export async function syncContactToBrevo({ email, prenom }: BrevoSyncInput) {
  if (!BREVO_API_KEY) {
    console.warn('[Brevo] BREVO_API_KEY manquante, sync skippée')
    return { success: false, reason: 'no-api-key' as const }
  }

  if (!email) {
    console.warn('[Brevo] Email manquant, sync skippée')
    return { success: false, reason: 'no-email' as const }
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        email,
        attributes: prenom ? { prenom } : {},
        listIds: [BREVO_LIST_MEMBRES],
        updateEnabled: true, // si le contact existe déjà, on l'ajoute juste à la liste
      }),
    })

    if (response.status === 201 || response.status === 204) {
      console.log('[Brevo] ✅ Contact synchronisé liste #9:', email)
      return { success: true as const }
    }

    const data = await response.json().catch(() => ({}))
    console.error('[Brevo] ⚠️ Sync échouée:', response.status, data)
    return { success: false, reason: 'api-error' as const, status: response.status, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    console.error('[Brevo] ❌ Exception sync:', message)
    return { success: false, reason: 'exception' as const, error: message }
  }
}