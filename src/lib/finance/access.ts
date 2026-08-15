function parseIds(value: string | undefined): Set<string> {
  return new Set(
    (value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  )
}

/**
 * Finance reste privé pendant la phase de test.
 * - En développement : FINANCE_DEV_PREVIEW=true autorise l’aperçu local,
 *   même si la session Supabase serveur n’est pas encore disponible.
 * - En production : seuls les UUID Supabase présents dans
 *   FINANCE_PRIVATE_BETA_USER_IDS passent.
 */
export function isFinanceBetaAllowed(userId: string | null | undefined): boolean {
  if (process.env.NODE_ENV !== 'production' && process.env.FINANCE_DEV_PREVIEW === 'true') {
    return true
  }

  if (!userId) return false
  return parseIds(process.env.FINANCE_PRIVATE_BETA_USER_IDS).has(userId)
}
