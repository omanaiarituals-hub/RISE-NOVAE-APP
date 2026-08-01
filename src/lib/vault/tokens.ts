import { createHmac, timingSafeEqual } from 'crypto'

const VAULT_UNLOCK_DURATION_MS = 5 * 60 * 1000

function getVaultSecret(): string {
  const secret = process.env.VAULT_TOKEN_SECRET

  if (!secret || secret.length < 32) {
    throw new Error(
      'VAULT_TOKEN_SECRET manquant ou trop court (32 caracteres minimum). ' +
        'Definir cette variable sur Vercel avant de deployer.'
    )
  }

  return secret
}

function signPayload(payload: string): string {
  return createHmac('sha256', getVaultSecret())
    .update(payload)
    .digest('hex')
}

export function createVaultAccessToken(userId: string): string {
  const expiresAt = Date.now() + VAULT_UNLOCK_DURATION_MS
  const payload = `${userId}.${expiresAt}`
  const signature = signPayload(payload)

  return `${payload}.${signature}`
}

export function verifyVaultAccessToken(token: string | null, userId: string): boolean {
  if (!token) return false

  const parts = token.split('.')
  if (parts.length !== 3) return false

  const [tokenUserId, expiresAtRaw, signature] = parts

  if (tokenUserId !== userId) return false

  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt)) return false
  if (expiresAt < Date.now()) return false

  const payload = `${tokenUserId}.${expiresAtRaw}`
  const expectedSignature = signPayload(payload)

  const received = Buffer.from(signature)
  const expected = Buffer.from(expectedSignature)

  if (received.length !== expected.length) return false

  return timingSafeEqual(received, expected)
}