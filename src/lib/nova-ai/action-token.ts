import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { NovaActionPlan } from './types'

const TOKEN_VERSION = 2
const DEFAULT_TTL_SECONDS = 20 * 60

interface NovaExecutionTokenPayload {
  version: 2
  executionId: string
  userId: string
  issuedAt: number
  expiresAt: number
  plan: NovaActionPlan
}

function base64UrlEncode(value: string | Buffer): string {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8')
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function base64UrlDecode(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return Buffer.from(`${normalized}${padding}`, 'base64')
}

function signingSecret(): string {
  const secret = process.env.NOVA_ACTION_SIGNING_SECRET?.trim()
  if (!secret || secret.length < 32) {
    throw new Error('NOVA_ACTION_SIGNING_SECRET doit contenir au moins 32 caractères.')
  }
  return secret
}

function signatureFor(encodedPayload: string): Buffer {
  return createHmac('sha256', signingSecret()).update(encodedPayload).digest()
}

function isExecutionPayload(value: unknown): value is NovaExecutionTokenPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<NovaExecutionTokenPayload>
  return (
    payload.version === TOKEN_VERSION &&
    typeof payload.executionId === 'string' &&
    payload.executionId.length >= 32 &&
    typeof payload.userId === 'string' &&
    typeof payload.issuedAt === 'number' &&
    typeof payload.expiresAt === 'number' &&
    !!payload.plan &&
    typeof payload.plan === 'object'
  )
}

export function createNovaExecutionToken(
  userId: string,
  plan: NovaActionPlan,
  ttlSeconds = DEFAULT_TTL_SECONDS
): string {
  const now = Math.floor(Date.now() / 1000)
  const payload: NovaExecutionTokenPayload = {
    version: TOKEN_VERSION,
    executionId: randomUUID(),
    userId,
    issuedAt: now,
    expiresAt: now + Math.max(60, ttlSeconds),
    plan,
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const encodedSignature = base64UrlEncode(signatureFor(encodedPayload))
  return `${encodedPayload}.${encodedSignature}`
}

export function verifyNovaExecutionToken(token: string): NovaExecutionTokenPayload {
  const [encodedPayload, encodedSignature, extra] = token.split('.')
  if (!encodedPayload || !encodedSignature || extra) {
    throw new Error('Jeton de validation invalide.')
  }

  const expectedSignature = signatureFor(encodedPayload)
  const receivedSignature = base64UrlDecode(encodedSignature)

  if (
    expectedSignature.length !== receivedSignature.length ||
    !timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    throw new Error('La proposition a été modifiée ou n’est plus valide.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8'))
  } catch {
    throw new Error('Jeton de validation illisible.')
  }

  if (!isExecutionPayload(parsed)) {
    throw new Error('Jeton de validation incomplet.')
  }

  if (parsed.expiresAt < Math.floor(Date.now() / 1000)) {
    throw new Error('Cette proposition a expiré. Demande à Nova de la préparer à nouveau.')
  }

  return parsed
}
