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

const provider = 'powens' as const

type JsonRecord = Record<string, any>

function domainHost() {
  const raw = process.env.POWENS_DOMAIN?.trim()
  if (!raw) return null
  return raw.replace(/^https?:\/\//, '').replace(/\.biapi\.pro\/?$/, '').replace(/\/$/, '')
}

function apiBase() {
  const d = domainHost()
  return d ? `https://${d}.biapi.pro/2.0` : null
}

function configured() {
  return Boolean(domainHost() && process.env.POWENS_CLIENT_ID && process.env.POWENS_CLIENT_SECRET)
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

async function powensFetch(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, cache: 'no-store' })
  if (!response.ok) {
    const payload = await parseJson(response)
    throw new BankingProviderError({
      provider,
      status: response.status,
      retryable: response.status >= 500 || response.status === 429,
      message: payload?.message || payload?.error_description || payload?.error || `Powens HTTP ${response.status}`,
    })
  }
  return response
}

function mapConnection(raw: JsonRecord): BankingConnection {
  const state = String(raw.state || '').toLowerCase()
  const status: BankingConnection['status'] = raw.deleted || raw.disabled
    ? 'disconnected'
    : !state || state === 'null'
      ? 'connected'
      : /sca|required|webauth|additional|decoupled|validating|wrongpass/.test(state)
        ? 'reauth_required'
        : /sync/.test(state)
          ? 'syncing'
          : 'error'

  return {
    providerConnectionId: String(raw.id ?? raw.id_connection ?? ''),
    providerUserId: raw.id_user != null ? String(raw.id_user) : undefined,
    institutionName: raw.connector?.name || raw.name || undefined,
    status,
    lastSyncedAt: raw.last_update || raw.last_sync || undefined,
    consentExpiresAt: raw.consent_expire_date || raw.consent_expires_at || undefined,
  }
}

function mapAccount(raw: JsonRecord): FinanceAccount {
  const identifier = String(raw.iban || raw.number || raw.webid || '')
  const masked = identifier ? `•••• ${identifier.slice(-4)}` : undefined
  return {
    providerAccountId: String(raw.id ?? ''),
    name: raw.name || raw.original_name || raw.type || 'Compte bancaire',
    type: raw.type || raw.usage || undefined,
    currency: raw.currency?.id || raw.currency || 'EUR',
    balance: Number.isFinite(Number(raw.balance)) ? Number(raw.balance) : undefined,
    availableBalance: Number.isFinite(Number(raw.available_balance)) ? Number(raw.available_balance) : undefined,
    maskedIdentifier: masked,
    isActive: raw.disabled !== true,
  }
}

function mapTransaction(raw: JsonRecord): FinanceTransaction {
  const signedAmount = Number(raw.value ?? raw.amount ?? 0)
  return {
    providerTransactionId: String(raw.id ?? ''),
    providerAccountId: String(raw.id_account ?? raw.account_id ?? ''),
    transactionDate: String(raw.date ?? raw.rdate ?? raw.vdate ?? new Date().toISOString().slice(0, 10)).slice(0, 10),
    valueDate: raw.vdate ? String(raw.vdate).slice(0, 10) : undefined,
    amount: Math.abs(signedAmount),
    currency: raw.currency?.id || raw.currency || 'EUR',
    rawLabel: raw.wording || raw.raw || raw.original_wording || undefined,
    merchantName: raw.simplified_wording || raw.merchant_name || undefined,
    direction: signedAmount >= 0 ? 'credit' : 'debit',
    providerCategory: raw.type || raw.category || undefined,
    metadata: {
      coming: raw.coming ?? undefined,
      active: raw.active ?? undefined,
    },
  }
}

export class PowensBankingProvider implements BankingProvider {
  readonly id = provider

  isConfigured() {
    return configured()
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new BankingProviderError({ provider, retryable: false, message: 'Powens n’est pas configuré.' })
    }
  }

  private async ensureCredential(novaeUserId: string) {
    const existing = await getProviderCredential(novaeUserId, provider)
    if (existing) return existing

    this.assertConfigured()
    const response = await powensFetch(`${apiBase()}/auth/init`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.POWENS_CLIENT_ID!,
        client_secret: process.env.POWENS_CLIENT_SECRET!,
      }),
    })

    const payload = await parseJson(response)
    const accessToken = payload.access_token || payload.token
    const providerUserId = payload.id_user != null
      ? String(payload.id_user)
      : payload.user?.id != null
        ? String(payload.user.id)
        : undefined

    if (!accessToken) {
      throw new BankingProviderError({ provider, retryable: false, message: 'Powens n’a pas renvoyé de jeton utilisateur.' })
    }

    await saveProviderCredential({ userId: novaeUserId, provider, providerUserId, accessToken })
    return { providerUserId, accessToken }
  }

  async createReadOnlyConnectionSession(input: { novaeUserId: string; returnUrl: string }): Promise<BankingConnectionSession> {
    this.assertConfigured()
    const { accessToken } = await this.ensureCredential(input.novaeUserId)
    const codeUrl = new URL(`${apiBase()}/auth/token/code`)
    codeUrl.searchParams.set('type', 'singleAccess')

    const response = await powensFetch(codeUrl.toString(), {
      headers: { authorization: `Bearer ${accessToken}` },
    })
    const payload = await parseJson(response)
    const code = payload.code || payload.auth_code
    if (!code) {
      throw new BankingProviderError({ provider, retryable: false, message: 'Impossible de générer le code Webview Powens.' })
    }

    const url = new URL(process.env.POWENS_WEBVIEW_URL || 'https://webview.powens.com/connect')
    url.searchParams.set('domain', domainHost()!)
    url.searchParams.set('client_id', process.env.POWENS_CLIENT_ID!)
    url.searchParams.set('redirect_uri', input.returnUrl)
    url.searchParams.set('code', String(code))
    return { url: url.toString() }
  }

  async listConnections(novaeUserId: string): Promise<BankingConnection[]> {
    const credential = await this.ensureCredential(novaeUserId)
    const response = await powensFetch(`${apiBase()}/users/me/connections?expand=connector`, {
      headers: { authorization: `Bearer ${credential.accessToken}` },
    })
    const payload = await parseJson(response)
    const items = payload.connections || payload.data || []
    return Array.isArray(items) ? items.map(mapConnection).filter((item) => item.providerConnectionId) : []
  }

  private async credentialForConnection(providerConnectionId: string) {
    const { supabaseAdmin } = await import('@/lib/supabase-admin')
    const { data, error } = await supabaseAdmin
      .from('finance_connections')
      .select('user_id')
      .eq('provider', provider)
      .eq('provider_connection_id', providerConnectionId)
      .maybeSingle()

    if (error || !data?.user_id) {
      throw new BankingProviderError({ provider, retryable: false, message: 'Connexion NOVAÉ/Powens introuvable.' })
    }

    const credential = await getProviderCredential(String(data.user_id), provider)
    if (!credential) {
      throw new BankingProviderError({ provider, retryable: false, message: 'Jeton Powens introuvable.' })
    }
    return credential
  }

  async listAccounts(providerConnectionId: string): Promise<FinanceAccount[]> {
    const credential = await this.credentialForConnection(providerConnectionId)
    const response = await powensFetch(`${apiBase()}/users/me/connections/${encodeURIComponent(providerConnectionId)}/accounts?all`, {
      headers: { authorization: `Bearer ${credential.accessToken}` },
    })
    const payload = await parseJson(response)
    const items = payload.accounts || payload.data || []
    return Array.isArray(items) ? items.map(mapAccount).filter((item) => item.providerAccountId) : []
  }

  async listTransactions(input: { providerConnectionId: string; since?: string }): Promise<FinanceTransaction[]> {
    const credential = await this.credentialForConnection(input.providerConnectionId)
    const url = new URL(`${apiBase()}/users/me/transactions`)
    url.searchParams.set('limit', '1000')
    if (input.since) url.searchParams.set('min_date', input.since.slice(0, 10))

    const response = await powensFetch(url.toString(), {
      headers: { authorization: `Bearer ${credential.accessToken}` },
    })
    const payload = await parseJson(response)
    const items = payload.transactions || payload.data || []
    const mapped = Array.isArray(items) ? items.map(mapTransaction) : []
    return mapped.filter((item) => item.providerTransactionId && item.providerAccountId)
  }

  async syncConnection(providerConnectionId: string): Promise<BankingSyncResult> {
    const credential = await this.credentialForConnection(providerConnectionId)
    const response = await powensFetch(`${apiBase()}/users/me/connections/${encodeURIComponent(providerConnectionId)}?expand=connector`, {
      headers: { authorization: `Bearer ${credential.accessToken}` },
    })
    const connection = mapConnection(await parseJson(response))
    const accounts = await this.listAccounts(providerConnectionId)
    const transactions = await this.listTransactions({ providerConnectionId })
    return { connection, accounts, transactions }
  }

  async disconnectConnection(providerConnectionId: string): Promise<void> {
    const credential = await this.credentialForConnection(providerConnectionId)
    await powensFetch(`${apiBase()}/users/me/connections/${encodeURIComponent(providerConnectionId)}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${credential.accessToken}` },
    })
  }

  async deleteNovaeUserCredential(novaeUserId: string) {
    await deleteProviderCredential(novaeUserId, provider)
  }

  async parseWebhook(input: { headers: Headers; rawBody: string }): Promise<BankingWebhookEvent> {
    const payload = JSON.parse(input.rawBody || '{}') as JsonRecord
    const type = String(payload.type || payload.event || payload.event_type || 'unknown')
    const connection = payload.connection || payload.data?.connection || {}
    const providerConnectionId = connection.id != null
      ? String(connection.id)
      : payload.id_connection != null
        ? String(payload.id_connection)
        : undefined
    const providerEventId = String(payload.id || payload.event_id || `${type}:${providerConnectionId || 'unknown'}:${payload.timestamp || Date.now()}`)
    return { providerEventId, type, providerConnectionId }
  }
}
