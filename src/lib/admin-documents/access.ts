export const ADMIN_DOCUMENTS_ALLOWED_EMAILS = [
  'nesserinesediri@gmail.com',
]

export function canAccessAdminDocuments(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_DOCUMENTS_ALLOWED_EMAILS.includes(email.toLowerCase())
}