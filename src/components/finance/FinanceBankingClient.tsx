'use client'

import { useEffect, useMemo, useState } from 'react'

type Status = {
  mode: 'read_only'
  configuredProvider: string
  adapterReady: boolean
  environment?: 'sandbox' | 'production_or_custom' | 'disabled'
  domainConfigured?: boolean
  clientConfigured?: boolean
  secretConfigured?: boolean
  connectorFilterConfigured?: boolean
  paymentsEnabled: false
  transfersEnabled: false
}

type FinanceAccountState = {
  id: string
  connection_id: string
  name: string
  custom_name: string | null
  account_type: string | null
  currency: string
  balance: number | null
  available_balance: number | null
  masked_identifier: string | null
  is_active: boolean
  user_enabled: boolean
  last_synced_at: string | null
}

type ConnectionState = {
  connected: boolean
  connections: Array<{
    id: string
    provider: string
    institution_name: string | null
    status: string
    last_synced_at: string | null
    consent_expires_at: string | null
    disconnected_at: string | null
  }>
  accounts: FinanceAccountState[]
}

function money(value: number | null | undefined, currency = 'EUR') {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(Number(value))
}

function dateTime(value: string | null | undefined) {
  if (!value) return 'Jamais'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

const enableBankingCompletionInFlight = new Set<string>()

export default function FinanceBankingClient({
  returnedFromProvider = false,
  authorizationCode,
  providerError,
}: {
  returnedFromProvider?: boolean
  authorizationCode?: string
  providerError?: string
}) {
  const [status, setStatus] = useState<Status | null>(null)
  const [state, setState] = useState<ConnectionState | null>(null)
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | `account:${string}` | null>(null)
  const [message, setMessage] = useState(providerError ? `Connexion bancaire interrompue : ${providerError}` : returnedFromProvider ? 'Connexion terminée. NOVAÉ récupère maintenant les comptes sélectionnés…' : '')
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

  async function refreshStatus() {
    try {
      const [statusResponse, stateResponse] = await Promise.all([
        fetch('/api/finance/provider-status', { cache: 'no-store' }),
        fetch('/api/finance/banking/state', { cache: 'no-store' }),
      ])
      if (statusResponse.ok) setStatus(await statusResponse.json())
      if (stateResponse.ok) setState(await stateResponse.json())
    } catch {
      setStatus(null)
    }
  }

  async function sync({ silent = false } = {}) {
    setBusy('sync')
    if (!silent) setMessage('')
    try {
      const response = await fetch('/api/finance/banking/sync', { method: 'POST' })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Synchronisation impossible')
      setMessage(`Synchronisation terminée : ${json.accounts ?? 0} compte(s) autorisé(s), ${json.transactions ?? 0} opération(s) traitée(s).`)
      await refreshStatus()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Synchronisation impossible')
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    void refreshStatus()
  }, [])

  useEffect(() => {
    if (!returnedFromProvider || providerError) return
    let cancelled = false
    const finish = async () => {
      try {
        if (authorizationCode) {
          if (enableBankingCompletionInFlight.has(authorizationCode)) return
          enableBankingCompletionInFlight.add(authorizationCode)
          setBusy('sync')
          try {
            const response = await fetch('/api/finance/banking/complete', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ code: authorizationCode }),
            })
            const json = await response.json()
            if (!response.ok) throw new Error(json.message || json.error || 'Finalisation bancaire impossible')
            if (!cancelled) {
              setMessage(`Connexion réelle terminée : ${json.accounts ?? 0} compte(s), ${json.transactions ?? 0} opération(s) synchronisée(s).`)
              // Le code Enable Banking est à usage unique : on le retire de
              // l'URL immédiatement pour qu'un refresh ne puisse pas le rejouer.
              window.history.replaceState({}, '', '/finances/banking')
              await refreshStatus()
            }
          } catch (error) {
            enableBankingCompletionInFlight.delete(authorizationCode)
            throw error
          }
        } else {
          await sync({ silent: true })
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Finalisation bancaire impossible')
      } finally {
        if (!cancelled) setBusy(null)
      }
    }
    const timer = window.setTimeout(() => { void finish() }, 500)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // Le retour fournisseur ne doit déclencher qu'un seul import.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnedFromProvider, authorizationCode, providerError])

  async function connect() {
    setBusy('connect')
    setMessage('')
    try {
      const response = await fetch('/api/finance/banking/connect', { method: 'POST' })
      const json = await response.json()
      if (!response.ok || !json.url) throw new Error(json.message || json.error || 'Connexion impossible')
      window.location.assign(json.url)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Connexion impossible')
      setBusy(null)
    }
  }

  async function disconnect() {
    if (!window.confirm('Déconnecter la banque de NOVAÉ Finance ? NOVAÉ ne pourra plus synchroniser de nouvelles opérations.')) return
    setBusy('disconnect')
    setMessage('')
    try {
      const response = await fetch('/api/finance/banking/disconnect', { method: 'POST' })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Déconnexion impossible')
      setMessage('Banque déconnectée. Les synchronisations sont arrêtées.')
      await refreshStatus()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Déconnexion impossible')
    } finally {
      setBusy(null)
    }
  }

  async function updateAccount(id: string, patch: { custom_name?: string; user_enabled?: boolean }) {
    setBusy(`account:${id}`)
    setMessage('')
    try {
      const response = await fetch(`/api/finance/banking/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.detail || json.error || 'Modification impossible')
      setEditingAccountId(null)
      setDraftName('')
      await refreshStatus()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Modification impossible')
    } finally {
      setBusy(null)
    }
  }

  const ready = status?.adapterReady === true
  const connected = state?.connected === true
  const sandbox = status?.environment === 'sandbox'
  const usedAccounts = useMemo(() => (state?.accounts ?? []).filter((account) => account.is_active && account.user_enabled), [state])
  const unusedAccounts = useMemo(() => (state?.accounts ?? []).filter((account) => !account.is_active || !account.user_enabled), [state])

  function accountName(account: FinanceAccountState) {
    return account.custom_name || account.name
  }

  function accountCard(account: FinanceAccountState, used: boolean) {
    const accountBusy = busy === `account:${account.id}`
    const canEnable = account.is_active
    return (
      <div key={account.id} className="rounded-2xl border border-[var(--novae-border)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {editingAccountId === account.id ? (
              <div className="flex flex-wrap gap-2">
                <input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  className="min-h-10 min-w-0 flex-1 rounded-xl border border-[var(--novae-border)] bg-[var(--novae-background)] px-3 text-sm"
                  placeholder={account.name}
                  autoFocus
                />
                <button type="button" disabled={accountBusy} onClick={() => void updateAccount(account.id, { custom_name: draftName })} className="rounded-full bg-[var(--novae-primary)] px-3 text-xs font-black text-white disabled:opacity-45">Enregistrer</button>
                <button type="button" onClick={() => { setEditingAccountId(null); setDraftName('') }} className="rounded-full border border-[var(--novae-border)] px-3 text-xs font-bold">Annuler</button>
              </div>
            ) : (
              <>
                <strong className="block truncate">{accountName(account)}</strong>
                {account.custom_name ? <p className="mt-1 truncate text-[11px] text-[var(--novae-text-muted)]">Banque : {account.name}</p> : null}
              </>
            )}
            <p className="mt-1 text-xs text-[var(--novae-text-muted)]">{account.masked_identifier || 'Identifiant masqué'}</p>
          </div>
          <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${used ? 'bg-emerald-100 text-emerald-800' : 'bg-black/5 text-[var(--novae-text-muted)]'}`}>
            {used ? 'Inclus' : account.is_active ? 'Exclu' : 'Non autorisé'}
          </span>
        </div>
        <p className="mt-4 text-2xl font-black">{money(account.balance, account.currency)}</p>
        <p className="mt-2 text-xs text-[var(--novae-text-muted)]">Dernière synchro : {dateTime(account.last_synced_at)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={accountBusy} onClick={() => { setEditingAccountId(account.id); setDraftName(account.custom_name || account.name) }} className="rounded-full border border-[var(--novae-border)] px-3 py-2 text-xs font-bold disabled:opacity-45">Renommer</button>
          {used ? (
            <button type="button" disabled={accountBusy} onClick={() => void updateAccount(account.id, { user_enabled: false })} className="rounded-full border border-[var(--novae-border)] px-3 py-2 text-xs font-bold text-[var(--novae-text-muted)] disabled:opacity-45">Retirer de NOVAÉ</button>
          ) : (
            <button type="button" disabled={accountBusy || !canEnable} onClick={() => void updateAccount(account.id, { user_enabled: true })} className="rounded-full border border-[var(--novae-border)] px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-45">Inclure dans NOVAÉ</button>
          )}
        </div>
        {!account.is_active ? <p className="mt-3 text-xs leading-5 text-[var(--novae-text-muted)]">Ce compte n’est plus autorisé par le fournisseur bancaire. Reconnecte la banque si tu veux le sélectionner à nouveau.</p> : null}
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
      <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-black uppercase tracking-[.16em] text-[var(--novae-primary)]">Open Banking · lecture seule</p>
          {status?.configuredProvider === 'powens' ? (
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${sandbox ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
              {sandbox ? 'Sandbox Powens' : 'Powens'}
            </span>
          ) : status?.configuredProvider === 'enable_banking' ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-800">Enable Banking · compte réel restreint</span>
          ) : null}
        </div>
        <h2 className="mt-2 font-[var(--novae-font-title)] text-3xl font-semibold sm:text-4xl">Connexion bancaire</h2>
        <p className="mt-3 max-w-2xl leading-7 text-[var(--novae-text-muted)]">
          La connexion et l’authentification bancaire se font dans l’interface sécurisée du fournisseur. NOVAÉ ne demande ni ne stocke ton identifiant ou ton mot de passe bancaire.
        </p>

        <div className="mt-6 rounded-2xl bg-[var(--novae-background)] p-4 text-sm leading-6">
          <div className="flex justify-between gap-4"><span>Fournisseur</span><strong>{status?.configuredProvider || '—'}</strong></div>
          <div className="mt-2 flex justify-between gap-4"><span>Environnement</span><strong>{sandbox ? 'Sandbox' : status?.configuredProvider === 'enable_banking' ? 'Production restreinte' : status?.environment === 'production_or_custom' ? 'Production' : 'Désactivé'}</strong></div>
          <div className="mt-2 flex justify-between gap-4"><span>Adaptateur</span><strong>{ready ? 'Prêt' : 'Non configuré'}</strong></div>
          <div className="mt-2 flex justify-between gap-4"><span>Connexion</span><strong>{connected ? 'Connectée' : 'Non connectée'}</strong></div>
          <div className="mt-2 flex justify-between gap-4"><span>Accès</span><strong>Lecture seule</strong></div>
          <div className="mt-2 flex justify-between gap-4"><span>Paiements / virements</span><strong>Désactivés</strong></div>
        </div>

        {status?.configuredProvider === 'powens' && !ready ? (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Configuration incomplète.</strong> Renseigne le domaine sandbox, le Client ID et le Client Secret côté serveur, puis redémarre NOVAÉ.</div>
        ) : null}
        {status?.configuredProvider === 'enable_banking' && ready ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
            Mode personnel restreint : NOVAÉ ne peut récupérer que les comptes que tu as explicitement liés à cette application Enable Banking.
          </div>
        ) : status?.configuredProvider === 'powens' && ready && !sandbox ? (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">Connexion Powens configurée hors sandbox.</div>
        ) : null}
        {message ? <p className="mt-4 rounded-2xl border border-[var(--novae-border)] p-4 text-sm">{message}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" disabled={!ready || busy !== null} onClick={connect} className="min-h-11 rounded-full bg-[var(--novae-primary)] px-5 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-45">{busy === 'connect' ? 'Ouverture…' : connected ? 'Reconnecter ma banque' : sandbox ? 'Connecter une banque de test' : 'Connecter mon compte réel'}</button>
          <button type="button" disabled={!ready || busy !== null} onClick={() => void sync()} className="min-h-11 rounded-full border border-[var(--novae-border)] bg-[var(--novae-surface)] px-5 font-extrabold disabled:cursor-not-allowed disabled:opacity-45">{busy === 'sync' ? 'Synchronisation…' : 'Synchroniser maintenant'}</button>
          <button type="button" disabled={!ready || !connected || busy !== null} onClick={disconnect} className="min-h-11 rounded-full border border-[var(--novae-border)] bg-transparent px-5 font-bold text-[var(--novae-text-muted)] disabled:cursor-not-allowed disabled:opacity-45">Déconnecter</button>
        </div>

        {state?.accounts?.length ? (
          <div className="mt-7 space-y-6">
            <div>
              <div className="flex items-center justify-between gap-3"><h3 className="font-black">Comptes utilisés par NOVAÉ</h3><span className="text-xs text-[var(--novae-text-muted)]">{usedAccounts.length} compte(s)</span></div>
              <p className="mt-1 text-xs leading-5 text-[var(--novae-text-muted)]">Seuls ces comptes alimentent le solde, les transactions, les prévisions et les analyses.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">{usedAccounts.map((account) => accountCard(account, true))}</div>
            </div>
            {unusedAccounts.length ? (
              <div>
                <div className="flex items-center justify-between gap-3"><h3 className="font-black">Comptes non utilisés</h3><span className="text-xs text-[var(--novae-text-muted)]">{unusedAccounts.length} compte(s)</span></div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">{unusedAccounts.map((account) => accountCard(account, false))}</div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <aside className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-6">
        <p className="text-sm font-black">Ce que NOVAÉ peut lire</p>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--novae-text-muted)]"><li>✓ Les comptes que tu choisis explicitement.</li><li>✓ Les soldes nécessaires au calcul du disponible réel.</li><li>✓ Les opérations utiles au budget et aux enveloppes.</li><li>✓ Les dates et libellés nécessaires à la catégorisation.</li></ul>
        <p className="mt-6 text-sm font-black">Ce que NOVAÉ ne peut pas faire</p>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--novae-text-muted)]"><li>× Effectuer un paiement.</li><li>× Effectuer ou initier un virement.</li><li>× Voir ton mot de passe bancaire.</li></ul>
        <div className="mt-6 rounded-2xl bg-[var(--novae-background)] p-4 text-xs leading-5 text-[var(--novae-text-muted)]">Un compte retiré de NOVAÉ conserve son historique synchronisé, mais il ne participe plus aux calculs. Pour modifier le consentement bancaire lui-même, repasse par le parcours sécurisé du fournisseur.</div>
      </aside>
    </div>
  )
}
