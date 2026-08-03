'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

const ADMIN_EMAILS = new Set(['nesserinesediri@gmail.com', 'omanaiarituals@gmail.com'])

type DashboardData = {
  generatedAt: string
  period: { days: number; since: string }
  landing: {
    pageViews: number
    uniqueVisitors: number
    totalClicks: number
    clickingVisitors: number
    visitorToClickRate: number
    pageViews24h: number
    pageViews7d: number
    scroll50Rate: number
    scroll75Rate: number
    scroll100Rate: number
    ctaBreakdown: { label: string; count: number }[]
    sources: { source: string; count: number }[]
    referrers: { referrer: string; count: number }[]
  }
  beta: {
    total: number
    last24h: number
    last7d: number
    inPeriod: number
    marketingConsentRate: number
    brevoSyncedRate: number
    convertedToAccount: number
    betaToAccountRate: number
    sources: { source: string; count: number }[]
    recent: {
      email: string
      source: string
      status: string
      brevoStatus: string
      consentMarketing: boolean
      createdAt: string
    }[]
  }
  product: {
    totalAccounts: number
    accountsCreatedInPeriod: number
    onboardingCompleted: number
    onboardingRate: number
    premiumUsers: number
    premiumRate: number
    nova: { actions: number; activeUsers: number }
    tasks: { actions: number; activeUsers: number }
    planner: { actions: number; activeUsers: number }
    notes: { actions: number; activeUsers: number }
    meals: { actions: number; activeUsers: number }
  }
  warnings: string[]
}

const palette = {
  background: '#f7f2eb',
  card: '#fffdf9',
  ink: '#2c211a',
  muted: '#74665d',
  line: '#e5d8cc',
  copper: '#a96f4d',
  green: '#58715a',
  red: '#a94f4f',
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <article style={{ background: palette.card, border: `1px solid ${palette.line}`, borderRadius: 18, padding: 18, minHeight: 120 }}>
      <div style={{ color: palette.muted, fontSize: 13, marginBottom: 12 }}>{label}</div>
      <div style={{ color: palette.ink, fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      {detail ? <div style={{ color: palette.muted, fontSize: 12, marginTop: 12 }}>{detail}</div> : null}
    </article>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, color: palette.ink, fontSize: 21 }}>{title}</h2>
        {subtitle ? <p style={{ margin: '6px 0 0', color: palette.muted, fontSize: 13 }}>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}

function Ranking({ rows, keyName }: { rows: Array<Record<string, string | number>>; keyName: string }) {
  const max = Math.max(1, ...rows.map((row) => Number(row.count || 0)))
  return (
    <div style={{ background: palette.card, border: `1px solid ${palette.line}`, borderRadius: 18, padding: 18 }}>
      {rows.length === 0 ? <p style={{ color: palette.muted }}>Aucune donnée sur la période.</p> : rows.slice(0, 10).map((row) => (
        <div key={String(row[keyName])} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 13, color: palette.ink }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(row[keyName])}</span>
            <strong>{row.count}</strong>
          </div>
          <div style={{ height: 7, background: '#eee4db', borderRadius: 999, marginTop: 7, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(Number(row.count) / max) * 100}%`, background: palette.copper, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function PilotageAdminPage() {
  const { user, loading: authLoading } = useSupabaseAuth()
  const router = useRouter()
  const [days, setDays] = useState(30)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = Boolean(user?.email && ADMIN_EMAILS.has(user.email.toLowerCase()))

  useEffect(() => {
    if (authLoading) return
    if (!user) router.replace('/login')
    else if (!isAdmin) router.replace('/')
  }, [authLoading, isAdmin, router, user])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Session administrateur introuvable')
      const response = await fetch(`/api/admin/pilotage?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Chargement impossible')
      setData(payload)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Erreur inconnue')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    if (isAdmin) void load()
  }, [isAdmin, load])

  const activationRows = useMemo(() => {
    if (!data) return []
    return [
      { label: 'Conversations Nova', ...data.product.nova },
      { label: 'Tâches créées', ...data.product.tasks },
      { label: 'Créneaux planning', ...data.product.planner },
      { label: 'Notes enregistrées', ...data.product.notes },
      { label: 'Repas planifiés', ...data.product.meals },
    ]
  }, [data])

  if (authLoading || !isAdmin) {
    return <main style={{ minHeight: '100vh', background: palette.background, padding: 40 }}>Vérification de l’accès…</main>
  }

  return (
    <main style={{ minHeight: '100vh', background: palette.background, padding: '28px clamp(16px, 4vw, 56px) 64px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: palette.copper, fontSize: 12, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase' }}>NOVAÉ — pilotage personnel</div>
          <h1 style={{ color: palette.ink, fontSize: 'clamp(28px, 4vw, 44px)', margin: '8px 0 6px' }}>Acquisition, bêta et activation</h1>
          <p style={{ color: palette.muted, margin: 0 }}>Une vue claire de ce qui attire, convertit et crée réellement de la valeur.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/admin" style={{ color: palette.ink, textDecoration: 'none', border: `1px solid ${palette.line}`, background: palette.card, padding: '10px 14px', borderRadius: 12 }}>Ancien admin</Link>
          <select value={days} onChange={(event) => setDays(Number(event.target.value))} style={{ border: `1px solid ${palette.line}`, background: palette.card, color: palette.ink, padding: '10px 14px', borderRadius: 12 }}>
            <option value={7}>7 jours</option>
            <option value={30}>30 jours</option>
            <option value={90}>90 jours</option>
            <option value={365}>12 mois</option>
          </select>
          <button onClick={() => void load()} disabled={loading} style={{ border: 0, background: palette.ink, color: 'white', padding: '11px 16px', borderRadius: 12, cursor: 'pointer' }}>{loading ? 'Actualisation…' : 'Actualiser'}</button>
        </div>
      </header>

      {error ? <div style={{ marginTop: 24, background: '#fff0ef', border: '1px solid #e3b5b1', color: palette.red, padding: 16, borderRadius: 14 }}>{error}</div> : null}
      {data?.warnings.length ? <div style={{ marginTop: 18, background: '#fff8e7', border: '1px solid #ead6a2', color: '#735d22', padding: 14, borderRadius: 14, fontSize: 13 }}>Certaines sources sont indisponibles : {data.warnings.join(' · ')}</div> : null}

      {data ? (
        <>
          <Section title="Vue dirigeante" subtitle={`Période analysée : ${data.period.days} jours`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
              <Metric label="Visiteurs uniques landing" value={data.landing.uniqueVisitors} detail={`${data.landing.pageViews} pages vues`} />
              <Metric label="Conversion visite → clic" value={`${data.landing.visitorToClickRate}%`} detail={`${data.landing.clickingVisitors} visiteurs ont cliqué`} />
              <Metric label="Inscriptions bêta" value={data.beta.total} detail={`+${data.beta.inPeriod} sur la période`} />
              <Metric label="Bêta → compte créé" value={`${data.beta.betaToAccountRate}%`} detail={`${data.beta.convertedToAccount} inscriptions converties`} />
              <Metric label="Comptes NOVAÉ" value={data.product.totalAccounts} detail={`+${data.product.accountsCreatedInPeriod} sur la période`} />
              <Metric label="Onboarding terminé" value={`${data.product.onboardingRate}%`} detail={`${data.product.onboardingCompleted} utilisatrices`} />
              <Metric label="Premium actifs" value={data.product.premiumUsers} detail={`${data.product.premiumRate}% des comptes`} />
            </div>
          </Section>

          <Section title="Landing page" subtitle="Trafic, intérêt et profondeur de lecture">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              <Metric label="Pages vues — 24 h" value={data.landing.pageViews24h} />
              <Metric label="Pages vues — 7 jours" value={data.landing.pageViews7d} />
              <Metric label="Clics CTA" value={data.landing.totalClicks} />
              <Metric label="Scroll à 50 %" value={`${data.landing.scroll50Rate}%`} />
              <Metric label="Scroll à 75 %" value={`${data.landing.scroll75Rate}%`} />
              <Metric label="Page lue à 100 %" value={`${data.landing.scroll100Rate}%`} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginTop: 14 }}>
              <div><h3 style={{ color: palette.ink }}>Clics par bouton</h3><Ranking rows={data.landing.ctaBreakdown} keyName="label" /></div>
              <div><h3 style={{ color: palette.ink }}>Sources UTM</h3><Ranking rows={data.landing.sources} keyName="source" /></div>
              <div><h3 style={{ color: palette.ink }}>Sites référents</h3><Ranking rows={data.landing.referrers} keyName="referrer" /></div>
            </div>
          </Section>

          <Section title="Bêta" subtitle="Qualité et origine des inscriptions">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
              <Metric label="Nouvelles inscriptions — 24 h" value={data.beta.last24h} />
              <Metric label="Nouvelles inscriptions — 7 jours" value={data.beta.last7d} />
              <Metric label="Consentement marketing" value={`${data.beta.marketingConsentRate}%`} />
              <Metric label="Synchronisation Brevo" value={`${data.beta.brevoSyncedRate}%`} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 0.8fr) minmax(420px, 1.4fr)', gap: 14, marginTop: 14 }}>
              <div><h3 style={{ color: palette.ink }}>Origine des inscrites</h3><Ranking rows={data.beta.sources} keyName="source" /></div>
              <div style={{ overflowX: 'auto', background: palette.card, border: `1px solid ${palette.line}`, borderRadius: 18, padding: 16 }}>
                <h3 style={{ color: palette.ink, marginTop: 0 }}>Dernières inscriptions</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720, fontSize: 13 }}>
                  <thead><tr>{['Date', 'Email', 'Source', 'Statut', 'Brevo', 'Consentement'].map((heading) => <th key={heading} style={{ textAlign: 'left', color: palette.muted, padding: '10px 8px', borderBottom: `1px solid ${palette.line}` }}>{heading}</th>)}</tr></thead>
                  <tbody>{data.beta.recent.map((row) => <tr key={`${row.email}-${row.createdAt}`}>
                    <td style={{ padding: 8, borderBottom: `1px solid ${palette.line}` }}>{new Date(row.createdAt).toLocaleString('fr-FR')}</td>
                    <td style={{ padding: 8, borderBottom: `1px solid ${palette.line}` }}>{row.email}</td>
                    <td style={{ padding: 8, borderBottom: `1px solid ${palette.line}` }}>{row.source}</td>
                    <td style={{ padding: 8, borderBottom: `1px solid ${palette.line}` }}>{row.status}</td>
                    <td style={{ padding: 8, borderBottom: `1px solid ${palette.line}` }}>{row.brevoStatus}</td>
                    <td style={{ padding: 8, borderBottom: `1px solid ${palette.line}` }}>{row.consentMarketing ? 'Oui' : 'Non'}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </div>
          </Section>

          <Section title="Première valeur créée" subtitle="Utilisation réelle des moteurs pendant la période">
            <div style={{ background: palette.card, border: `1px solid ${palette.line}`, borderRadius: 18, overflow: 'hidden' }}>
              {activationRows.map((row, index) => (
                <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px', gap: 12, padding: 16, borderBottom: index < activationRows.length - 1 ? `1px solid ${palette.line}` : undefined }}>
                  <strong style={{ color: palette.ink }}>{row.label}</strong>
                  <span style={{ color: palette.muted }}>{row.actions} actions</span>
                  <span style={{ color: palette.muted }}>{row.activeUsers} utilisatrices</span>
                </div>
              ))}
            </div>
          </Section>

          <p style={{ color: palette.muted, fontSize: 12, marginTop: 26 }}>Dernière mise à jour : {new Date(data.generatedAt).toLocaleString('fr-FR')}</p>
        </>
      ) : loading ? <p style={{ marginTop: 30, color: palette.muted }}>Chargement des indicateurs…</p> : null}
    </main>
  )
}
