import { createHash, createSign, randomUUID } from 'node:crypto'
import type { BankingProvider } from '../provider'
import { BankingProviderError } from '../provider'
import type {
  BankingConnection,
  BankingConnectionSession,
  BankingSyncResult,
  BankingWebhookEvent,
  FinanceAccount,
  FinanceTransaction,
} from '../types'
import { deleteProviderCredential, getProviderCredential, saveProviderCredential } from '../credential-store'
import { supabaseAdmin } from '@/lib/supabase-admin'

const provider = 'enable_banking' as const
const API_BASE = 'https://api.enablebanking.com'

type JsonRecord = Record<string, any>

function appId() {
  return process.env.ENABLE_BANKING_APPLICATION_ID?.trim() || ''
}

function privateKeyPem() {
  const encoded = process.env.ENABLE_BANKING_PRIVATE_KEY_BASE64?.trim()
  if (!encoded) return ''
  try {
    return Buffer.from(encoded, 'base64').toString('utf8')
  } catch {
    return ''
  }
}

function aspspName() {
  return process.env.ENABLE_BANKING_ASPSP_NAME?.trim() || ''
}

function aspspCountry() {
  return (process.env.ENABLE_BANKING_ASPSP_COUNTRY?.trim() || 'FR').toUpperCase()
}

function psuType() {
  const value = (process.env.ENABLE_BANKING_PSU_TYPE?.trim() || 'personal').toLowerCase()
  return value === 'business' ? 'business' : 'personal'
}

function configured() {
  return Boolean(appId() && privateKeyPem() && aspspName())
}

function base64url(value: Buffer | string) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function createJwt() {
  if (!configured()) {
    throw new BankingProviderError({
      provider,
      retryable: false,
      message: 'Enable Banking n’est pas configuré.',
    })
  }

  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: appId() }))
  const payload = base64url(JSON.stringify({
    iss: 'enablebanking.com',
    aud: 'api.enablebanking.com',
    iat: now,
    exp: now + 3600,
  }))
  const unsigned = `${header}.${payload}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  signer.end()
  const signature = signer.sign(privateKeyPem())
  return `${unsigned}.${base64url(signature)}`
}

async function parseJson(response: Response): Promise<JsonRecord> {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as JsonRecord
  } catch {
    return { raw: text }
  }
}

async function enableFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${createJwt()}`)
  headers.set('accept', 'application/json')
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  })

  if (!response.ok) {
    const payload = await parseJson(response)
    throw new BankingProviderError({
      provider,
      status: response.status,
      retryable: response.status >= 500 || response.status === 429 || response.status === 408,
      message:
        payload?.detail ||
        payload?.message ||
        payload?.error_description ||
        payload?.error ||
        payload?.code ||
        `Enable Banking HTTP ${response.status}`,
    })
  }

  return response
}

function safeDate(value: unknown) {
  if (!value) return undefined
  const raw = String(value)
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function sessionStatus(raw: string): BankingConnection['status'] {
  const value = raw.toUpperCase()
  if (value === 'AUTHORIZED') return 'connected'
  if (/PENDING|AUTHORIZ/.test(value)) return 'pending'
  if (/EXPIRED|REVOKED|CLOSED|CANCEL/.test(value)) return 'reauth_required'
  if (/ERROR|FAILED/.test(value)) return 'error'
  return 'connected'
}

function accountUid(raw: JsonRecord) {
  return raw.uid ? String(raw.uid) : ''
}

function accountIdentifier(raw: JsonRecord) {
  const accountId = raw.account_id || {}
  const iban = accountId.iban || accountId.identification
  if (iban) return String(iban)
  const ids = Array.isArray(raw.all_account_ids) ? raw.all_account_ids : []
  const preferred = ids.find((item: JsonRecord) => item?.identification)
  return preferred?.identification ? String(preferred.identification) : ''
}

function chooseBalance(items: JsonRecord[], wanted: string[]) {
  for (const type of wanted) {
    const found = items.find((item) => String(item.balance_type || '').toUpperCase() === type)
    const amount = Number(found?.balance_amount?.amount)
    if (Number.isFinite(amount)) return amount
  }
  for (const item of items) {
    const amount = Number(item?.balance_amount?.amount)
    if (Number.isFinite(amount)) return amount
  }
  return undefined
}

function transactionLabel(raw: JsonRecord) {
  const remittance = Array.isArray(raw.remittance_information)
    ? raw.remittance_information.filter(Boolean).join(' · ')
    : raw.remittance_information
      ? String(raw.remittance_information)
      : ''
  return (
    remittance ||
    raw.creditor?.name ||
    raw.debtor?.name ||
    raw.bank_transaction_code?.description ||
    raw.note ||
    raw.reference_number ||
    'Opération bancaire'
  )
}

function transactionId(raw: JsonRecord, accountId: string) {
  const explicit = raw.entry_reference || raw.transaction_id
  if (explicit) return String(explicit)
  const material = [
    accountId,
    raw.booking_date || raw.transaction_date || raw.value_date || '',
    raw.transaction_amount?.amount || '',
    raw.transaction_amount?.currency || '',
    transactionLabel(raw),
    raw.reference_number || '',
  ].join('|')
  return `eb:${createHash('sha256').update(material).digest('hex').slice(0, 40)}`
}

export class EnableBankingProvider implements BankingProvider {
  readonly id = provider

  isConfigured() {
    return configured()
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new BankingProviderError({
        provider,
        retryable: false,
        message: 'Enable Banking n’est pas configuré.',
      })
    }
  }

  private async sessionCredential(novaeUserId: string) {
    const credential = await getProviderCredential(novaeUserId, provider)
    if (!credential?.accessToken) return null
    return {
      sessionId: credential.accessToken,
      institutionKey: credential.providerUserId,
    }
  }

  private async userForConnection(providerConnectionId: string) {
    const { data, error } = await supabaseAdmin
      .from('finance_connections')
      .select('user_id')
      .eq('provider', provider)
      .eq('provider_connection_id', providerConnectionId)
      .maybeSingle()

    if (error || !data?.user_id) {
      throw new BankingProviderError({
        provider,
        retryable: false,
        message: 'Connexion NOVAÉ/Enable Banking introuvable.',
      })
    }
    return String(data.user_id)
  }

  private async getSession(sessionId: string) {
    const response = await enableFetch(`/sessions/${encodeURIComponent(sessionId)}`)
    return parseJson(response)
  }

  async createReadOnlyConnectionSession(input: {
    novaeUserId: string
    returnUrl: string
  }): Promise<BankingConnectionSession> {
    this.assertConfigured()

    // URL explicite utile si l'application Production Enable Banking n'autorise
    // que le domaine NOVAÉ. Sinon, on reprend l'origine courante (localhost en dev).
    const redirectUrl = process.env.ENABLE_BANKING_REDIRECT_URL?.trim() || input.returnUrl
    const daysRaw = Number(process.env.ENABLE_BANKING_CONSENT_DAYS || '90')
    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(180, Math.floor(daysRaw))) : 90
    const validUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

    const response = await enableFetch('/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        access: { valid_until: validUntil },
        aspsp: { name: aspspName(), country: aspspCountry() },
        state: randomUUID(),
        redirect_url: redirectUrl,
        psu_type: psuType(),
        language: 'fr',
      }),
    })
    const payload = await parseJson(response)
    if (!payload.url) {
      throw new BankingProviderError({
        provider,
        retryable: false,
        message: 'Enable Banking n’a pas renvoyé de lien d’autorisation.',
      })
    }
    return { url: String(payload.url), expiresAt: validUntil }
  }

  async completeReadOnlyConnectionSession(input: {
    novaeUserId: string
    code: string
  }): Promise<void> {
    this.assertConfigured()
    if (!input.code.trim()) {
      throw new BankingProviderError({
        provider,
        retryable: false,
        message: 'Code d’autorisation Enable Banking absent.',
      })
    }

    const response = await enableFetch('/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: input.code.trim() }),
    })
    const payload = await parseJson(response)
    const sessionId = payload.session_id
    if (!sessionId) {
      throw new BankingProviderError({
        provider,
        retryable: false,
        message: 'Enable Banking n’a pas renvoyé de session bancaire.',
      })
    }

    const institution = payload.aspsp?.name
      ? `${payload.aspsp.name}|${payload.aspsp.country || aspspCountry()}`
      : `${aspspName()}|${aspspCountry()}`

    // Le champ "accessToken" du coffre est un conteneur chiffré générique côté
    // NOVAÉ. Pour Enable Banking il contient uniquement l'identifiant de session,
    // jamais un identifiant/mot de passe bancaire.
    await saveProviderCredential({
      userId: input.novaeUserId,
      provider,
      providerUserId: institution,
      accessToken: String(sessionId),
    })
  }

  async listConnections(novaeUserId: string): Promise<BankingConnection[]> {
    this.assertConfigured()
    const credential = await this.sessionCredential(novaeUserId)
    if (!credential) return []

    const payload = await this.getSession(credential.sessionId)
    const institutionName = payload.aspsp?.name || credential.institutionKey?.split('|')[0] || aspspName()

    return [{
      providerConnectionId: credential.sessionId,
      providerUserId: credential.institutionKey,
      institutionName,
      status: sessionStatus(String(payload.status || 'AUTHORIZED')),
      lastSyncedAt: new Date().toISOString(),
      consentExpiresAt: safeDate(payload.access?.valid_until),
    }]
  }

  async listAccounts(providerConnectionId: string): Promise<FinanceAccount[]> {
    const userId = await this.userForConnection(providerConnectionId)
    const credential = await this.sessionCredential(userId)
    if (!credential || credential.sessionId !== providerConnectionId) {
      throw new BankingProviderError({
        provider,
        retryable: false,
        message: 'Session Enable Banking introuvable.',
      })
    }

    const session = await this.getSession(providerConnectionId)
    const rawAccounts: JsonRecord[] = Array.isArray(session.accounts_data) ? session.accounts_data : []

    const result: FinanceAccount[] = []
    for (const raw of rawAccounts) {
      const uid = accountUid(raw)
      if (!uid) continue
      let balances: JsonRecord[] = []
      try {
        const response = await enableFetch(`/accounts/${encodeURIComponent(uid)}/balances`)
        const payload = await parseJson(response)
        balances = Array.isArray(payload.balances) ? payload.balances : Array.isArray(payload) ? payload : []
      } catch (error) {
        // Un compte reste affichable même si une banque ne fournit pas de solde.
        if (!(error instanceof BankingProviderError) || error.status === 401 || error.status === 403) throw error
      }

      const identifier = accountIdentifier(raw)
      result.push({
        providerAccountId: uid,
        name: raw.name || raw.product || 'Compte bancaire',
        type: raw.cash_account_type || raw.usage || undefined,
        currency: raw.currency || balances[0]?.balance_amount?.currency || 'EUR',
        balance: chooseBalance(balances, ['CLBD', 'ITBD', 'PRCD', 'OPBD']),
        availableBalance: chooseBalance(balances, ['ITAV', 'CLAV', 'FWAV', 'OPAV']),
        maskedIdentifier: identifier ? `•••• ${identifier.slice(-4)}` : undefined,
        isActive: true,
      })
    }
    return result
  }

  async listTransactions(input: {
    providerConnectionId: string
    since?: string
  }): Promise<FinanceTransaction[]> {
    const userId = await this.userForConnection(input.providerConnectionId)
    const credential = await this.sessionCredential(userId)
    if (!credential || credential.sessionId !== input.providerConnectionId) {
      throw new BankingProviderError({
        provider,
        retryable: false,
        message: 'Session Enable Banking introuvable.',
      })
    }

    const session = await this.getSession(input.providerConnectionId)
    const rawAccounts: JsonRecord[] = Array.isArray(session.accounts_data) ? session.accounts_data : []
    const result: FinanceTransaction[] = []

    for (const account of rawAccounts) {
      const uid = accountUid(account)
      if (!uid) continue

      let continuationKey: string | undefined
      let page = 0
      do {
        const params = new URLSearchParams()
        if (input.since) params.set('date_from', input.since.slice(0, 10))
        if (continuationKey) params.set('continuation_key', continuationKey)
        const suffix = params.toString() ? `?${params.toString()}` : ''
        const response = await enableFetch(`/accounts/${encodeURIComponent(uid)}/transactions${suffix}`)
        const payload = await parseJson(response)
        const transactions: JsonRecord[] = Array.isArray(payload.transactions) ? payload.transactions : []

        for (const raw of transactions) {
          // Pending transactions may not have stable identifiers. Keep them visible
          // only if Enable Banking/bank exposes a stable reference.
          const status = String(raw.status || '').toUpperCase()
          if (status === 'PDNG' && !raw.entry_reference && !raw.transaction_id) continue

          const signedIndicator = String(raw.credit_debit_indicator || '').toUpperCase()
          const amount = Math.abs(Number(raw.transaction_amount?.amount || 0))
          if (!Number.isFinite(amount)) continue
          const direction: 'credit' | 'debit' = signedIndicator === 'CRDT' ? 'credit' : 'debit'
          const label = transactionLabel(raw)

          result.push({
            providerTransactionId: transactionId(raw, uid),
            providerAccountId: uid,
            transactionDate: String(raw.booking_date || raw.transaction_date || raw.value_date || new Date().toISOString().slice(0, 10)).slice(0, 10),
            valueDate: raw.value_date ? String(raw.value_date).slice(0, 10) : undefined,
            amount,
            currency: raw.transaction_amount?.currency || account.currency || 'EUR',
            rawLabel: label,
            merchantName: raw.creditor?.name || raw.debtor?.name || undefined,
            direction,
            providerCategory: raw.bank_transaction_code?.description || raw.merchant_category_code || undefined,
            metadata: {
              status: raw.status || undefined,
              entry_reference: raw.entry_reference || undefined,
              merchant_category_code: raw.merchant_category_code || undefined,
              reference_number: raw.reference_number || undefined,
              balance_after_transaction: raw.balance_after_transaction || undefined,
            },
          })
        }

        continuationKey = payload.continuation_key ? String(payload.continuation_key) : undefined
        page += 1
      } while (continuationKey && page < 20)
    }

    return result
  }

  async syncConnection(providerConnectionId: string): Promise<BankingSyncResult> {
    const userId = await this.userForConnection(providerConnectionId)
    const [connection] = await this.listConnections(userId)
    if (!connection) {
      throw new BankingProviderError({
        provider,
        retryable: false,
        message: 'Connexion Enable Banking introuvable.',
      })
    }
    const accounts = await this.listAccounts(providerConnectionId)
    const transactions = await this.listTransactions({ providerConnectionId })
    return { connection, accounts, transactions }
  }

  async disconnectConnection(providerConnectionId: string): Promise<void> {
    try {
      await enableFetch(`/sessions/${encodeURIComponent(providerConnectionId)}`, { method: 'DELETE' })
    } catch (error) {
      if (!(error instanceof BankingProviderError) || error.status !== 404) throw error
    }
  }

  async deleteNovaeUserCredential(novaeUserId: string) {
    await deleteProviderCredential(novaeUserId, provider)
  }

  async parseWebhook(input: {
    headers: Headers
    rawBody: string
  }): Promise<BankingWebhookEvent> {
    // Finance V1 n'utilise pas de webhook de paiement. On conserve uniquement
    // une enveloppe minimale et non sensible si un webhook AIS est ajouté plus tard.
    let payload: JsonRecord = {}
    try {
      payload = JSON.parse(input.rawBody || '{}') as JsonRecord
    } catch {}
    return {
      providerEventId: String(payload.id || payload.event_id || `enable-banking:${Date.now()}`),
      type: String(payload.type || payload.event || 'unknown'),
      providerConnectionId: payload.session_id ? String(payload.session_id) : undefined,
    }
  }
}
