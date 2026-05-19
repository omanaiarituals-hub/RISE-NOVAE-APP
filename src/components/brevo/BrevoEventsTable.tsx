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

interface MessageRow {
  messageId: string
  email: string
  subject: string
  sentAt: string
  hasRequests: boolean
  hasDelivered: boolean
  hasOpened: boolean
  hasClicked: boolean
  hasBounced: boolean
  hasUnsub: boolean
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
      const res = await fetch(`/api/admin/metrics/brevo-events?days=${days}&limit=1000`, {
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

  // ─── Groupement par messageId : un email = une ligne ───
  const messages: MessageRow[] = (() => {
    const map = new Map<string, MessageRow>()
    events.forEach(e => {
      if (!e.messageId) return
      let row = map.get(e.messageId)
      if (!row) {
        row = {
          messageId: e.messageId,
          email: e.email,
          subject: e.subject || '',
          sentAt: e.date,
          hasRequests: false,
          hasDelivered: false,
          hasOpened: false,
          hasClicked: false,
          hasBounced: false,
          hasUnsub: false,
        }
        map.set(e.messageId, row)
      }
      switch (e.event) {
        case 'requests':
          row.hasRequests = true
          row.sentAt = e.date
          break
        case 'delivered':
          row.hasDelivered = true
          break
        case 'opened':
        case 'proxy_open':
          row.hasOpened = true
          break
        case 'clicked':
          row.hasClicked = true
          break
        case 'soft_bounce':
        case 'hard_bounce':
        case 'blocked':
        case 'spam':
        case 'invalid_email':
          row.hasBounced = true
          break
        case 'unsubscribed':
          row.hasUnsub = true
          break
      }
    })
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
    )
  })()

  // KPIs basés sur messages uniques
  const totalSent = messages.filter(m => m.hasRequests || m.hasDelivered).length
  const totalDelivered = messages.filter(m => m.hasDelivered).length
  const totalOpened = messages.filter(m => m.hasOpened).length
  const totalClicked = messages.filter(m => m.hasClicked).length
  const totalBounces = messages.filter(m => m.hasBounced).length
  const totalUnsub = messages.filter(m => m.hasUnsub).length
  const openRate = totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 100) : 0
  const clickRate = totalDelivered > 0 ? Math.round((totalClicked / totalDelivered) * 100) : 0

  return (
    <section style={{ background: '#fdf8f1', border: '1px solid rgba(196,149,106,0.25)', borderRadius: 20, padding: 28, marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 26, color: '#3d2618', margin: 0 }}>Activité Brevo</h3>
          <p style={{ fontSize: 12, color: '#6b5340', margin: '4px 0 0', letterSpacing: '0.05em' }}>Un email envoyé = une ligne · {days} derniers jours</p>
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

      {/* KPI cards */}
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
              <th style={{ ...th, minWidth: 320 }}>Parcours de l'email</th>
            </tr>
          </thead>
          <tbody>
            {messages.length === 0 && !loading && (
              <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: '#6b5340', padding: 24, fontStyle: 'italic' }}>Aucun email envoyé sur la période</td></tr>
            )}
            {loading && messages.length === 0 && (
              <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: '#6b5340', padding: 24 }}>Chargement...</td></tr>
            )}
            {messages.map((m) => (
              <tr key={m.messageId} style={{ borderBottom: '1px solid rgba(196,149,106,0.08)' }}>
                <td style={{ ...td, whiteSpace: 'nowrap', color: '#6b5340' }}>
                  {new Date(m.sentAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{m.email}</td>
                <td style={{ ...td, color: '#6b5340', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.subject || <span style={{ color: '#a8967a' }}>—</span>}
                </td>
                <td style={{ ...td, padding: '8px 14px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                    <Pill label="Envoyé" active={m.hasRequests || m.hasDelivered} type="sent" />
                    <Arrow active={m.hasDelivered} />
                    <Pill label="Livré" active={m.hasDelivered} type="delivered" />
                    <Arrow active={m.hasOpened} />
                    <Pill label="Ouvert" active={m.hasOpened} type="opened" />
                    <Arrow active={m.hasClicked} />
                    <Pill label="Cliqué" active={m.hasClicked} type="clicked" />
                    {m.hasBounced && (
                      <>
                        <span style={{ margin: '0 4px', color: '#c44a4a' }}>·</span>
                        <Pill label="Bounce" active={true} type="bounce" />
                      </>
                    )}
                    {m.hasUnsub && (
                      <>
                        <span style={{ margin: '0 4px', color: '#737373' }}>·</span>
                        <Pill label="Désabo" active={true} type="unsub" />
                      </>
                    )}
                  </div>
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

function Pill({ label, active, type }: { label: string; active: boolean; type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounce' | 'unsub' }) {
  const palette: Record<string, string> = {
    sent: '#94a3b8',
    delivered: '#16a34a',
    opened: '#c4956a',
    clicked: '#8b5a3c',
    bounce: '#c44a4a',
    unsub: '#737373',
  }
  const color = palette[type]
  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: 999,
      background: active ? color : '#f5f5f4',
      color: active ? '#ffffff' : '#a8a29e',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      opacity: active ? 1 : 0.6,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function Arrow({ active }: { active: boolean }) {
  return (
    <span style={{
      color: active ? '#8b5a3c' : '#d6d3d1',
      fontSize: 10,
      fontWeight: 700,
      opacity: active ? 1 : 0.4,
    }}>→</span>
  )
}

const th: React.CSSProperties = { textAlign: 'left', padding: '12px 14px', fontWeight: 700, color: '#6b5340', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }
const td: React.CSSProperties = { padding: '10px 14px', color: '#3d2618', verticalAlign: 'middle' }