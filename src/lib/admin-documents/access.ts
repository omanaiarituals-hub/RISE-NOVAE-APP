/**
 * Accès au module Documents administratifs.
 *
 * Avant ouverture publique, ce module était limité à une whitelist d'e-mails.
 * Il est désormais accessible à tout utilisateur authentifié.
 *
 * Les routes API conservent leurs contrôles d'authentification, leurs limites
 * et les protections RLS : ce helper ne remplace pas l'auth, il supprime
 * uniquement l'ancien verrou de test privé.
 */
export function canAccessAdminDocuments(
  email: string | null | undefined
): boolean {
  return Boolean(email)
}
