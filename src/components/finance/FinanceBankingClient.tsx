'use client'

import { useEffect, useState } from 'react'

type Status = {
  mode?: string
  configuredProvider?: string
  adapterReady?: boolean
  paymentsEnabled?: boolean
  transfersEnabled?: boolean
}

export default function FinanceBankingClient({ returnedFromProvider = false }: { returnedFromProvider?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | null>(null)
  const [message, setMessage] = useState(returnedFromProvider ? 'Connexion terminée. Lance la synchronisation pour importer les comptes sélectionnés.' : '')

  async function refreshStatus() {
    try {
      const response = await fetch('/api/finance/provider-status', { cache: 'no-store' })
      const json = await response.json()
      if (response.ok) setStatus(json)
    } catch { setStatus(null) }
  }

  useEffect(() => { void refreshStatus() }, [])

  async function connect() {
    setBusy('connect'); setMessage('')
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

  async function sync() {
    setBusy('sync'); setMessage('')
    try {
      const response = await fetch('/api/finance/banking/sync', { method: 'POST' })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Synchronisation impossible')
      setMessage(`Synchronisation terminée : ${json.accounts ?? 0} compte(s), ${json.transactions ?? 0} opération(s) traitée(s).`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Synchronisation impossible')
    } finally { setBusy(null) }
  }

  async function disconnect() {
    if (!window.confirm('Déconnecter la banque de NOVAÉ Finance ? NOVAÉ ne pourra plus synchroniser de nouvelles opérations.')) return
    setBusy('disconnect'); setMessage('')
    try {
      const response = await fetch('/api/finance/banking/disconnect', { method: 'POST' })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Déconnexion impossible')
      setMessage('Banque déconnectée. Les synchronisations sont arrêtées.')
      await refreshStatus()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Déconnexion impossible')
    } finally { setBusy(null) }
  }

  const ready = status?.adapterReady === true

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
          <div className="mt-2 flex justify-between gap-4"><span>Accès</span><strong>Lecture seule</strong></div>
          <div className="mt-2 flex justify-between gap-4"><span>Paiements / virements</span><strong>Désactivés</strong></div>
        </div>

        {message ? <p className="mt-4 rounded-2xl border border-[var(--novae-border)] p-4 text-sm">{message}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" disabled={!ready || busy !== null} onClick={connect} className="min-h-11 rounded-full bg-[var(--novae-primary)] px-5 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-45">
            {busy === 'connect' ? 'Ouverture…' : 'Connecter ma banque'}
          </button>
          <button type="button" disabled={!ready || busy !== null} onClick={sync} className="min-h-11 rounded-full border border-[var(--novae-border)] bg-[var(--novae-surface)] px-5 font-extrabold disabled:cursor-not-allowed disabled:opacity-45">
            {busy === 'sync' ? 'Synchronisation…' : 'Synchroniser maintenant'}
          </button>
          <button type="button" disabled={!ready || busy !== null} onClick={disconnect} className="min-h-11 rounded-full border border-[var(--novae-border)] bg-transparent px-5 font-bold text-[var(--novae-text-muted)] disabled:cursor-not-allowed disabled:opacity-45">
            Déconnecter
          </button>
        </div>
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
      </aside>
    </div>
  )
}
