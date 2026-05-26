'use client'

import { useEffect, useState } from 'react'

interface SubStatus {
  hasActive: boolean
  cancelAtPeriodEnd?: boolean
  periodEnd?: number | null
}

export default function CancelSubscription() {
  const [sub, setSub] = useState<SubStatus | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/stripe/cancel', { credentials: 'include' })
      .then(r => r.json())
      .then(setSub)
      .catch(() => setSub({ hasActive: false }))
  }, [])

  // Rien à afficher si pas d'abonnement actif (membres gratuits)
  if (!sub || !sub.hasActive) return null

  const fmt = (ts?: number | null) =>
    ts ? new Date(ts * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

  const handleCancel = async () => {
    setCancelling(true)
    setError('')
    try {
      const r = await fetch('/api/stripe/cancel', { method: 'POST', credentials: 'include' })
      const d = await r.json()
      if (!r.ok) {
        setError(
          d.error === 'no_active_subscription'
            ? "Aucun abonnement actif trouvé."
            : "Une erreur est survenue. Réessaie."
        )
        setCancelling(false)
        return
      }
      setSub({ hasActive: true, cancelAtPeriodEnd: true, periodEnd: d.periodEnd })
      setShowModal(false)
    } catch {
      setError('Erreur de connexion. Réessaie.')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div style={card}>
      <h2 style={title}>Mon abonnement</h2>

      {sub.cancelAtPeriodEnd ? (
        <p style={desc}>
          Ton abonnement Premium est <strong>résilié</strong>. Tu gardes l'accès jusqu'au{' '}
          <strong>{fmt(sub.periodEnd)}</strong>, puis il s'arrêtera tout seul. Aucun nouveau prélèvement.
        </p>
      ) : (
        <>
          <p style={desc}>
            Tu es membre Premium. Tu peux résilier quand tu veux : tu gardes l'accès jusqu'à la fin de la
            période déjà payée, sans nouveau prélèvement.
          </p>
          <button
            onClick={() => { setShowModal(true); setError('') }}
            style={cancelBtn}
          >
            Annuler mon abonnement
          </button>
        </>
      )}

      {showModal && (
        <div onClick={() => !cancelling && setShowModal(false)} style={overlay}>
          <div onClick={e => e.stopPropagation()} style={modalBox}>
            <h3 style={modalTitle}>Annuler ton abonnement ?</h3>
            <p style={{ fontSize: 14, color: '#3d2618', lineHeight: 1.6, margin: '0 0 16px' }}>
              Tu gardes l'accès à tout NOVAÉ jusqu'à la fin de ta période en cours
              {sub.periodEnd ? <> (le <strong>{fmt(sub.periodEnd)}</strong>)</> : null}. Ensuite, ton compte
              repassera en gratuit. Tu pourras te réabonner à tout moment.
            </p>
            {error && <p style={errBox}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowModal(false)} disabled={cancelling} style={ghostBtn}>
                Garder Premium
              </button>
              <button onClick={handleCancel} disabled={cancelling} style={confirmBtn}>
                {cancelling ? 'Annulation…' : 'Confirmer la résiliation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const card: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.25))',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(255, 255, 255, 0.5)',
  borderRadius: 20,
  padding: 22,
  marginBottom: 16,
  boxShadow: '0 4px 16px rgba(139, 90, 60, 0.06)',
  fontFamily: "'DM Sans', sans-serif",
}

const title: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 20,
  color: '#3d2618',
  margin: '0 0 4px',
  fontWeight: 500,
}

const desc: React.CSSProperties = {
  fontSize: 12.5,
  color: '#6b5340',
  margin: '0 0 16px',
  lineHeight: 1.5,
  opacity: 0.9,
}

const cancelBtn: React.CSSProperties = {
  width: '100%',
  padding: '12px 20px',
  borderRadius: 14,
  border: '1px solid rgba(180, 80, 80, 0.4)',
  background: 'rgba(255, 255, 255, 0.5)',
  color: '#8b3a3a',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 999,
  background: 'rgba(26, 26, 26, 0.55)',
  backdropFilter: 'blur(3px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
}

const modalBox: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: 20,
  maxWidth: 420,
  width: '100%',
  padding: 28,
  boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
  fontFamily: "'DM Sans', sans-serif",
}

const modalTitle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 26,
  fontWeight: 600,
  color: '#8b3a3a',
  margin: '0 0 12px',
}

const errBox: React.CSSProperties = {
  fontSize: 12,
  color: '#8b3a3a',
  background: 'rgba(180, 80, 80, 0.08)',
  padding: '10px 12px',
  borderRadius: 10,
  margin: '0 0 16px',
}

const ghostBtn: React.CSSProperties = {
  flex: 1,
  padding: '12px',
  borderRadius: 12,
  border: '1px solid #e5e5e5',
  background: '#ffffff',
  color: '#3d2618',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const confirmBtn: React.CSSProperties = {
  flex: 1,
  padding: '12px',
  borderRadius: 12,
  border: 'none',
  background: 'linear-gradient(135deg, #c44a4a, #8b3a3a)',
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
}