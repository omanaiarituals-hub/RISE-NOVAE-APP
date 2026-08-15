import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'

function keyBuffer(): Buffer {
  const raw = process.env.FINANCE_CREDENTIAL_ENCRYPTION_KEY?.trim()
  if (!raw) throw new Error('FINANCE_CREDENTIAL_ENCRYPTION_KEY manquante')

  if (/^[a-fA-F0-9]{64}$/.test(raw)) return Buffer.from(raw, 'hex')

  const base64 = Buffer.from(raw, 'base64')
  if (base64.length === 32) return base64

  throw new Error('FINANCE_CREDENTIAL_ENCRYPTION_KEY doit contenir 32 octets (64 hex ou base64)')
}

export function encryptCredential(value: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: tag.toString('base64'),
  }
}

export function decryptCredential(input: { ciphertext: string; iv: string; authTag: string }) {
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer(), Buffer.from(input.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(input.authTag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}
