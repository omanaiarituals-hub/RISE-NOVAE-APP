'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface BrevoEvent {
  email: string
  date: string
  subject?: string
  event: string
  messageId?: string
  templateId?: number
}

export default function BrevoEventsTable() {
  const [events, setEvents] = useState<BrevoEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(14)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Pas de session active')
        setEvents([])
        return
      }
      const res = await fetch(`/api/admin/metrics/brevo-events?days=${days}&limit=500`, {
        headers: { authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || `Erreur ${res.status}`)
      }
      setEvents(data.events || [])
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [days]) // eslint-disable-line

  const counters = events.reduce((acc, e) => {
    acc[e.event] = (acc[e.event] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const totalSent = counters.requests || 0
  const totalDelivered = counters.delivered || 0
  const totalOpened = counters.opened || 0
  const totalClicked = counters.clicked || 0
  const totalBounces = (counters.soft_bounce || 0) + (counters.hard_bounce || 0)
  const totalUnsub = counters.unsubscribed || 0
  const openRate = totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 100) : 0
  const clickRate = totalDelivered > 0 ? Math.round((totalClicked / totalDelivered) * 100) : 0

  return (
    <section style={{ background: '#fdf8f1', border: '1px solid rgba(196,149,106,0.25)', borderRadius: 20, padding: 28, marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 26, color: '#3d2618', margin: 0 }}>Activité Brevo</h3>
          <p style={{ fontSize: 12, color: '#6b5340', margin: '4px 0 0', letterSpacing: '0.05em' }}>Détail des emails envoyés sur les derniers {days} jours</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(196,149,106,0.3)', background: '#fff', fontSize: 13, color: '#3d2618' }}>
            <option value={7}>7 jours</option>
            <option value={14}>14 jours</option>
            <option value={30}>30 jours</option>
            <option value={90}>90 jours</option>
          </select>
          <button onClick={load} disabled={loading} style={{ padding: '8px 16px', borderRadius: 8, background: 'linear-gradient(135deg,#c4956a 0%,#8b5a3c 100%)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
            {loading ? '...' : 'Actualiser'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 24 }}>
        <KPI label="Envoyés" value={totalSent} />
        <KPI label="Livrés" value={totalDelivered} sub={totalSent > 0 ? `${Math.round((totalDelivered / totalSent) * 100)}%` : '—'} />
        <KPI label="Ouverts" value={totalOpened} sub={`${openRate}% taux`} accent />
        <KPI label="Cliqués" value={totalClicked} sub={`${clickRate}% taux`} accent />
        <KPI label="Bounces" value={totalBounces} alert={totalBounces > 0} />
        <KPI label="Désabos" value={totalUnsub} alert={totalUnsub > 0} />
      </div>

      {error && (
        <div style={{ padding: 14, background: '#fef2f2', borderRadius: 8, color: '#991b1b', marginBottom: 14, fontSize: 13, border: '1px solid #fca5a5' }}>
          ⚠ {error}
        </div>
      )}

      <div style={{ maxHeight: 600, overflow: 'auto', border: '1px solid rgba(196,149,106,0.2)', borderRadius: 12, background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f5e8d8', zIndex: 1 }}>
            <tr>
              <th style={th}>Date</th>
              <th style={th}>Destinataire</th>
              <th style={th}>Objet</th>
              <th style={th}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && !loading && (
              <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: '#6b5340', padding: 24, fontStyle: 'italic' }}>Aucun événement sur la période</td></tr>
            )}
            {loading && events.length === 0 && (
              <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: '#6b5340', padding: 24 }}>Chargement...</td></tr>
            )}
            {events.map((e, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(196,149,106,0.08)' }}>
                <td style={{ ...td, whiteSpace: 'nowrap', color: '#6b5340' }}>
                  {new Date(e.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{e.email}</td>
                <td style={{ ...td, color: '#6b5340', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.subject || <span style={{ color: '#a8967a' }}>—</span>}
                </td>
                <td style={td}>
                  <span style={badgeStyle(e.event)}>{eventLabel(e.event)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function KPI({ label, value, sub, accent, alert }: { label: string; value: number; sub?: string; accent?: boolean; alert?: boolean }) {
  return (
    <div style={{
      background: accent ? 'linear-gradient(135deg,#c4956a 0%,#8b5a3c 100%)' : '#fff',
      border: alert ? '1px solid #fca5a5' : '1px solid rgba(196,149,106,0.2)',
      borderRadius: 12,
      padding: 14,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: accent ? 'rgba(255,255,255,0.85)' : '#6b5340', fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 28, color: accent ? '#fff' : (alert ? '#991b1b' : '#3d2618'), fontWeight: 500, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: accent ? 'rgba(255,255,255,0.75)' : '#6b5340', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function eventLabel(event: string): string {
  const labels: Record<string, string> = {
    requests: 'Envoyé', delivered: 'Livré', opened: 'Ouvert', clicked: 'Cliqué',
    soft_bounce: 'Bounce léger', hard_bounce: 'Bounce dur', spam: 'Spam',
    blocked: 'Bloqué', unsubscribed: 'Désabonné', invalid_email: 'Email invalide',
    deferred: 'Différé', proxy_open: 'Ouvert (proxy)', error: 'Erreur',
  }
  return labels[event] || event
}

function badgeStyle(event: string): React.CSSProperties {
  const colors: Record<string, { bg: string; fg: string }> = {
    requests: { bg: '#e7e5e4', fg: '#44403c' },
    delivered: { bg: '#dcfce7', fg: '#166534' },
    opened: { bg: '#fef3c7', fg: '#92400e' },
    clicked: { bg: '#fed7aa', fg: '#9a3412' },
    soft_bounce: { bg: '#fef9c3', fg: '#854d0e' },
    hard_bounce: { bg: '#fee2e2', fg: '#991b1b' },
    spam: { bg: '#fee2e2', fg: '#991b1b' },
    blocked: { bg: '#fee2e2', fg: '#991b1b' },
    unsubscribed: { bg: '#d6d3d1', fg: '#44403c' },
    invalid_email: { bg: '#fee2e2', fg: '#991b1b' },
    deferred: { bg: '#e0f2fe', fg: '#075985' },
  }
  const c = colors[event] || { bg: '#e7e5e4', fg: '#44403c' }
  return {
    display: 'inline-block', padding: '3px 10px', borderRadius: 999,
    background: c.bg, color: c.fg, fontSize: 11, fontWeight: 600,
  }
}

const th: React.CSSProperties = { textAlign: 'left', padding: '12px 14px', fontWeight: 700, color: '#6b5340', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }
const td: React.CSSProperties = { padding: '10px 14px', color: '#3d2618', verticalAlign: 'middle' }