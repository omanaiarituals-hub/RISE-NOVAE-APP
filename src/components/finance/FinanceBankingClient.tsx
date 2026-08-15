'use client'

import { useEffect, useState } from 'react'

type Status = {
  mode?: string
  configuredProvider?: string
  adapterReady?: boolean
  paymentsEnabled?: boolean
  transfersEnabled?: boolean
  authSource?: string
}

type ConnectionState = {
  connected?: boolean
  connections?: Array<{
    id: string
    provider: string
    institution_name: string | null
    status: string
    last_synced_at: string | null
    consent_expires_at: string | null
    disconnected_at: string | null
  }>
  accounts?: Array<{
    id: string
    name: string
    currency: string
    balance: number | null
    available_balance: number | null
    masked_identifier: string | null
    is_active: boolean
    last_synced_at: string | null
  }>
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

export default function FinanceBankingClient({ returnedFromProvider = false }: { returnedFromProvider?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [state, setState] = useState<ConnectionState | null>(null)
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | null>(null)
  const [message, setMessage] = useState(returnedFromProvider ? 'Connexion terminée. NOVAÉ récupère maintenant les comptes sélectionnés…' : '')

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
      setMessage(`Synchronisation terminée : ${json.accounts ?? 0} compte(s), ${json.transactions ?? 0} opération(s) traitée(s).`)
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
    if (!returnedFromProvider) return
    const timer = window.setTimeout(() => { void sync({ silent: true }) }, 800)
    return () => window.clearTimeout(timer)
    // On ne veut lancer l'import de retour qu'une fois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnedFromProvider])

  async function connect() {
    setBusy('connect')
    setMessage('')
    try {
      const response = await fetch('/api/finance/banking/connect', { method: 'POST' })
      const json = await response.json()
      if (!response.ok || !json.url) throw new Error(json.error || 'Connexion impossible')
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

  const ready = status?.adapterReady === true
  const connected = state?.connected === true

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
      <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[.16em] text-[var(--novae-primary)]">Open Banking · lecture seule</p>
        <h2 className="mt-2 font-[var(--novae-font-title)] text-3xl font-semibold sm:text-4xl">Connexion bancaire</h2>
        <p className="mt-3 max-w-2xl leading-7 text-[var(--novae-text-muted)]">
          La connexion et l’authentification bancaire se font dans l’interface sécurisée du fournisseur. NOVAÉ ne demande ni ne stocke ton identifiant ou ton mot de passe bancaire.
        </p>

        <div className="mt-6 rounded-2xl bg-[var(--novae-background)] p-4 text-sm leading-6">
          <div className="flex justify-between gap-4"><span>Fournisseur</span><strong>{status?.configuredProvider || '—'}</strong></div>
          <div className="mt-2 flex justify-between gap-4"><span>Adaptateur</span><strong>{ready ? 'Prêt' : 'Non configuré'}</strong></div>
          <div className="mt-2 flex justify-between gap-4"><span>Connexion</span><strong>{connected ? 'Connectée' : 'Non connectée'}</strong></div>
          <div className="mt-2 flex justify-between gap-4"><span>Accès</span><strong>Lecture seule</strong></div>
          <div className="mt-2 flex justify-between gap-4"><span>Paiements / virements</span><strong>Désactivés</strong></div>
        </div>

        {message ? <p className="mt-4 rounded-2xl border border-[var(--novae-border)] p-4 text-sm">{message}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" disabled={!ready || busy !== null} onClick={connect} className="min-h-11 rounded-full bg-[var(--novae-primary)] px-5 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-45">
            {busy === 'connect' ? 'Ouverture…' : connected ? 'Ajouter / reconnecter une banque' : 'Connecter ma banque'}
          </button>
          <button type="button" disabled={!ready || busy !== null} onClick={() => void sync()} className="min-h-11 rounded-full border border-[var(--novae-border)] bg-[var(--novae-surface)] px-5 font-extrabold disabled:cursor-not-allowed disabled:opacity-45">
            {busy === 'sync' ? 'Synchronisation…' : 'Synchroniser maintenant'}
          </button>
          <button type="button" disabled={!ready || !connected || busy !== null} onClick={disconnect} className="min-h-11 rounded-full border border-[var(--novae-border)] bg-transparent px-5 font-bold text-[var(--novae-text-muted)] disabled:cursor-not-allowed disabled:opacity-45">
            Déconnecter
          </button>
        </div>

        {state?.accounts?.length ? (
          <div className="mt-7">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-black">Comptes synchronisés</h3>
              <span className="text-xs text-[var(--novae-text-muted)]">{state.accounts.length} compte(s)</span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {state.accounts.map((account) => (
                <div key={account.id} className="rounded-2xl border border-[var(--novae-border)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <strong>{account.name}</strong>
                      <p className="mt-1 text-xs text-[var(--novae-text-muted)]">{account.masked_identifier || 'Identifiant masqué'}</p>
                    </div>
                    <span className="rounded-full bg-black/5 px-2 py-1 text-[11px] font-bold">{account.is_active ? 'Actif' : 'Inactif'}</span>
                  </div>
                  <p className="mt-4 text-2xl font-black">{money(account.balance, account.currency)}</p>
                  <p className="mt-2 text-xs text-[var(--novae-text-muted)]">Dernière synchro : {dateTime(account.last_synced_at)}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <aside className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 sm:p-6">
        <p className="text-sm font-black">Ce que NOVAÉ peut lire</p>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--novae-text-muted)]">
          <li>✓ Les comptes que tu choisis explicitement.</li>
          <li>✓ Les soldes nécessaires au calcul du disponible réel.</li>
          <li>✓ Les opérations utiles au budget et aux enveloppes.</li>
          <li>✓ Les dates et libellés nécessaires à la catégorisation.</li>
        </ul>
        <p className="mt-6 text-sm font-black">Ce que NOVAÉ ne peut pas faire</p>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--novae-text-muted)]">
          <li>× Effectuer un paiement.</li>
          <li>× Effectuer ou initier un virement.</li>
          <li>× Voir ton mot de passe bancaire.</li>
        </ul>
        <div className="mt-6 rounded-2xl bg-[var(--novae-background)] p-4 text-xs leading-5 text-[var(--novae-text-muted)]">
          Le Lot 2 utilise d’abord la sandbox Powens. Aucune donnée bancaire réelle n’est nécessaire pour valider le parcours technique.
        </div>
      </aside>
    </div>
  )
}
