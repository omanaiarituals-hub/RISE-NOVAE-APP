'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import BrevoEventsTable from '@/components/brevo/BrevoEventsTable'

const ADMIN_EMAILS = ['nesserinesediri@gmail.com',]
const LAUNCH_DATE = new Date('2026-05-01') // Référence pour M1 / M2 / M3
const REVIEW_STORAGE_KEY = 'novae_admin_review_v1'

const C = {
  cream: '#FBF4EC',
  brown: '#3d2618',
  brownLight: '#6b5340',
  brownMid: '#8b6f55',
  copper: '#c4956a',
  copperLight: '#d4a574',
  copperDark: '#8b5a3c',
  red: '#c44a4a',
  green: '#5C7044',
  yellow: '#A8852E',
  purple: '#7E63A8',
}

interface UserRow {
  user_id: string
  pseudo: string
  profile_created_at: string
  current_day: number
  program_started_at: string | null
  last_activity: string | null
  activity_count_7d: number
  community_posts: number
  agent_messages: number
  is_struggling: boolean
}

interface Challenge {
  id: string
  title: string
  description: string
  emoji: string
  starts_at: string
  ends_at: string
  is_active: boolean
  participants_count?: number
  completed_count?: number
}

interface Post {
  id: string
  user_id: string
  content: string
  likes_count: number
  comments_count: number
  created_at: string
  pseudo?: string
}

interface ManualKpis {
  conversion: string
  mrr: string
  churn: string
  tiktokViews: string
  ctrBio: string
  emailOpenRate: string
  kFactor: string
}

interface LandingMetrics {
  period: { days: number; since: string }
  pageViews:      { last24h: number; last7d: number; total: number }
  uniqueVisitors: { last24h: number; last7d: number; total: number }
  cta: {
    totalClicks: number
    breakdown: { label: string; count: number }[]
    conversionRate: number
    sessionsClickedAnyMain: number
    sessionsClickedHero: number
    sessionsClickedFinal: number
    sessionsClickedQuiz: number
    sessionsClickedBlog: number
    sessionsClickedContact: number
    totalSessions: number
  }
  traffic: {
    directVisits: number
    topReferrers: { referrer: string; count: number }[]
    utmBreakdown: { source: string; medium: string; campaign: string; count: number }[]
  }
  scrollDepth: {
    totalSessions: number
    reachedQuarter: number
    reachedHalf: number
    reachedThreeQuarters: number
    reachedFull: number
  }
  quiz: {
    total: number
    last24h: number
    last7d: number
    profilBreakdown: { profil: string; count: number }[]
    leads: { email: string; score: number | null; profil: string | null; scoreLabel: string | null; date: string }[]
  }
}

const DEFAULT_MANUAL_KPIS: ManualKpis = {
  conversion: '', mrr: '', churn: '',
  tiktokViews: '', ctrBio: '', emailOpenRate: '', kFactor: '',
}

type KpiKey = 'all' | 'onboarded' | 'active_24h' | 'active_7d' | 'on_program' | 'struggling' | 'community' | 'never_active'
type Tab = 'stats' | 'challenges' | 'posts' | 'review' | 'landing' | 'audience'
// ─── Roadmap status — extrait du dossier V2 Pro ───
const ROADMAP_VALIDATED: Record<string, string[]> = {
  'Modules app (P.1 du dossier)': [
    'Dashboard 9 tuiles',
    'Programme 90j (3 phases)',
    'Planner + To-do',
    'Habit Tracker',
    'Défis + Badges',
    'Recettes & Courses',
    'Famille & Proches',
    'Agent IA NOVAÉ (Claude API + bilan hebdo cron)',
    'Paramètres',
    'Blog SEO (3 articles)',
    'Quiz charge mentale + diagnostic IA',
    'Onboarding 10Q (UI flow complet)',
  ],
  'Infra & lancement': [
    'Domaine novae-by-omanaia.com (landing)',
    'app.novae-by-omanaia.com (app)',
    'Brevo SMTP configuré',
    'Email J0 bienvenue automatique (template 6)',
    'Late Welcome batch 10/10 (template 16)',
    'Cron Vercel 18h UTC notif flammes en danger',
  ],
  'Sprint Streak + Badges (10/05/2026)': [
    'Tables user_streaks / user_badges / user_events',
    'Flamme animée compacte + bouton « Je suis là »',
    'Jour de répit 1/sem',
    '10 badges + modale + partage communauté',
    'Page /profil/badges',
  ],
  'Stratégie contenu': [
    '90 épisodes Chroniques de NOVAÉ scriptés',
  ],
}

const ROADMAP_PENDING: Record<string, string[]> = {
  'P0 — bloqueurs': [
    'Stripe Premium (~3j) — bloqueur revenu',
    'Paywall élégant (dépend Stripe)',
    'Email J+2 inactif Brevo (rédigé, paramétrage à faire)',
    'Bug template Brevo #16 → rediriger vers app.novae-by-omanaia.com/retour?p={{params.prenom}}',
  ],
  'P1 — semaines 2-4': [
    'Emails J+7 / J+10 / J+30 (rédigés, paramétrage Brevo)',
    'Lettre IA fin de Phase 1 (J30)',
    'Streak freeze Premium (1x/mois)',
    'Missions contenu J31-J60',
    'Mode Traversée Difficile IA (auto-trigger)',
    'Habit tracker : 3 → illimité Premium',
  ],
  'P2 — mois 2': [
    'Referral program (lien unique)',
    'Communauté feed (community-badges.ts à brancher)',
    'Badges J60 / J90 + lettres IA',
    'A/B test onboarding 5Q vs 10Q',
    'Pinterest 3 pins/sem',
  ],
  'Bugs / nettoyage': [
    'Doublon streak : retirer 🔥 8j de la carte Programme 90j',
    'Tester cron streak-reminder demain 18h UTC',
  ],
}

export default function AdminPage() {
  const { user, loading: authLoading } = useSupabaseAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('stats')
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserRow[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedKpi, setSelectedKpi] = useState<KpiKey>('all')
  const [periodDays, setPeriodDays] = useState(30)

  // Streaks (table user_streaks — sprint 10/05)
  const [avgStreak, setAvgStreak] = useState(0)
  const [streakCount, setStreakCount] = useState(0)

  // Stats Brevo (auto via API route)
  const [brevoStats, setBrevoStats] = useState<{
    period: { startDate: string; endDate: string; days: number }
    raw: { requests: number; delivered: number; uniqueOpens: number; uniqueClicks: number; hardBounces: number; softBounces: number; totalBounces: number }
    computed: { openRate: number; clickRate: number; bounceRate: number; deliveryRate: number }
  } | null>(null)
  const [brevoLoading, setBrevoLoading] = useState(false)
  const [brevoError, setBrevoError] = useState<string | null>(null)
  const [landingStats, setLandingStats] = useState<LandingMetrics | null>(null)
const [landingLoading, setLandingLoading] = useState(false)
const [landingError, setLandingError] = useState<string | null>(null)
const [authUserCount, setAuthUserCount] = useState<number | null>(null)

// ─── ROADMAP éditable (persistée en localStorage) ───
const ROADMAP_STORAGE_KEY = 'novae_admin_roadmap_v1'
const DEFAULT_ROADMAP = {
  validated: ROADMAP_VALIDATED,
  pending:   ROADMAP_PENDING,
}
const [roadmapData, setRoadmapData] = useState<{
  validated: Record<string, string[]>
  pending:   Record<string, string[]>
}>(DEFAULT_ROADMAP)
const [adding, setAdding] = useState<{column: 'validated' | 'pending', category: string} | null>(null)
const [newItemText, setNewItemText] = useState('')

  // ─── Audience / Démographie ───────────────────────────────────────────────
  const [audienceData, setAudienceData] = useState<{
    demographie: { tranche_age: string; count: number }[]
    localisation: { localisation: string; count: number }[]
    a_enfants: { a_enfants: string; count: number }[]
    secteur: { secteur_activite: string; count: number }[]
    consenties: number
    total: number
    modules: { event_type: string; count: number }[]
  } | null>(null)

  const loadAudienceData = async () => {
    const [profRes, eventsRes, consentRes] = await Promise.all([
      supabase.from('ai_personality_profile').select('tranche_age, localisation, a_enfants, secteur_activite'),
      supabase.from('user_events').select('event_type').like('event_type', 'module_%'),
      supabase.from('users').select('consent_commercial'),
    ])
    const profiles = profRes.data || []
    const events = eventsRes.data || []
    const consents = consentRes.data || []

    // Agrégation démographique
    const count = (arr: any[], key: string) => {
      const map: Record<string, number> = {}
      arr.forEach(r => { const v = r[key] || 'Non renseigné'; map[v] = (map[v] || 0) + 1 })
      return Object.entries(map).map(([k, v]) => ({ [key]: k, count: v })).sort((a, b) => b.count - a.count)
    }

    // Agrégation modules
    const modMap: Record<string, number> = {}
    events.forEach(e => { modMap[e.event_type] = (modMap[e.event_type] || 0) + 1 })
    const modules = Object.entries(modMap)
      .map(([event_type, count]) => ({ event_type, count }))
      .sort((a, b) => b.count - a.count)

    setAudienceData({
      demographie: count(profiles, 'tranche_age') as any,
      localisation: count(profiles, 'localisation') as any,
      a_enfants: count(profiles, 'a_enfants') as any,
      secteur: count(profiles, 'secteur_activite') as any,
      consenties: consents.filter(c => c.consent_commercial).length,
      total: consents.length,
      modules,
    })
  }

  // Saisies manuelles revue dominicale (Stripe + Marketing)
  const [manualKpis, setManualKpis] = useState<ManualKpis>(DEFAULT_MANUAL_KPIS)
  const [lastReviewAt, setLastReviewAt] = useState<string | null>(null)

  // Formulaire défi
  const [showForm, setShowForm] = useState(false)
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null)
  const [formData, setFormData] = useState({
    title: '', description: '', emoji: '🎯',
    starts_at: '', ends_at: '', is_active: true,
  })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/auth'); return }
    if (!user.email || !ADMIN_EMAILS.includes(user.email)) { router.push('/'); return }
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading])

  // Charger les saisies manuelles depuis localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(REVIEW_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        setManualKpis({ ...DEFAULT_MANUAL_KPIS, ...(parsed.kpis || {}) })
        setLastReviewAt(parsed.lastReviewAt || null)
      }
    } catch {}
  }, [])

  // Charger la roadmap depuis localStorage
useEffect(() => {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(ROADMAP_STORAGE_KEY)
    if (raw) setRoadmapData(JSON.parse(raw))
  } catch {}
}, [])

  const persistManualKpis = (next: ManualKpis) => {
    setManualKpis(next)
    if (typeof window === 'undefined') return
    const data = { kpis: next, lastReviewAt: new Date().toISOString() }
    try {
      localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(data))
      setLastReviewAt(data.lastReviewAt)
    } catch {}
  }

  // Persiste la roadmap
const persistRoadmap = (next: typeof roadmapData) => {
  setRoadmapData(next)
  if (typeof window === 'undefined') return
  try { localStorage.setItem(ROADMAP_STORAGE_KEY, JSON.stringify(next)) } catch {}
}

// Déplace un item d'une colonne à l'autre (validé ↔ en attente)
const toggleItem = (from: 'validated' | 'pending', category: string, item: string) => {
  const to = from === 'validated' ? 'pending' : 'validated'
  persistRoadmap({
    ...roadmapData,
    [from]: {
      ...roadmapData[from],
      [category]: (roadmapData[from][category] || []).filter(i => i !== item),
    },
    [to]: {
      ...roadmapData[to],
      [category]: [...(roadmapData[to][category] || []), item],
    },
  })
}

// Supprime définitivement
const removeItem = (column: 'validated' | 'pending', category: string, item: string) => {
  persistRoadmap({
    ...roadmapData,
    [column]: {
      ...roadmapData[column],
      [category]: (roadmapData[column][category] || []).filter(i => i !== item),
    },
  })
}

// Ajoute un nouvel item
const addItem = (column: 'validated' | 'pending', category: string) => {
  const text = newItemText.trim()
  if (!text) return
  persistRoadmap({
    ...roadmapData,
    [column]: {
      ...roadmapData[column],
      [category]: [...(roadmapData[column][category] || []), text],
    },
  })
  setNewItemText('')
  setAdding(null)
}

// Reset complet
const resetRoadmap = () => {
  if (!confirm('Restaurer la roadmap par défaut ? Tu perdras tes modifications.')) return
  persistRoadmap(DEFAULT_ROADMAP)
}

  const updateManualKpi = (key: keyof ManualKpis, value: string) => {
    persistManualKpis({ ...manualKpis, [key]: value })
  }

  const loadAll = async () => {
    setLoading(true)
await Promise.all([loadUsers(), loadChallenges(), loadPosts(), loadStreaks(), loadBrevoStats(), loadLandingStats(), loadAuthUserCount(), loadAudienceData()])  
  setLoading(false)
  }

  const loadStreaks = async () => {
    // Si ta colonne s'appelle autrement (ex: current, streak_count), adapte ici.
    const { data, error } = await supabase
      .from('user_streaks')
      .select('current_count')
    if (error || !data || data.length === 0) {
      setAvgStreak(0); setStreakCount(0); return
    }
    const counts = data
      .map((r: any) => Number(r.current_count) || 0)
      .filter(n => n > 0)
    if (counts.length === 0) { setAvgStreak(0); setStreakCount(0); return }
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length
    setAvgStreak(avg)
    setStreakCount(counts.length)
  }

  const loadBrevoStats = async () => {
    setBrevoLoading(true)
    setBrevoError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setBrevoError('Pas de session active')
        setBrevoStats(null)
        return
      }
      const res = await fetch('/api/admin/metrics/brevo?days=7', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) {
        setBrevoError(data.error || `Erreur ${res.status}`)
        setBrevoStats(null)
      } else {
        setBrevoStats(data)
      }
    } catch (e: any) {
      setBrevoError(e?.message || 'Erreur inconnue')
      setBrevoStats(null)
    } finally {
      setBrevoLoading(false)
    }
  }

  const loadLandingStats = async () => {
  setLandingLoading(true)
  setLandingError(null)
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      setLandingError('Pas de session active')
      setLandingStats(null)
      return
    }
    const res = await fetch('/api/admin/metrics/landing?days=30', {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
      cache: 'no-store',
    })
    const data = await res.json()
    if (!res.ok) {
      setLandingError(data.error || `Erreur ${res.status}`)
      setLandingStats(null)
    } else {
      setLandingStats(data)
    }
  } catch (e: any) {
    setLandingError(e?.message || 'Erreur inconnue')
    setLandingStats(null)
  } finally {
    setLandingLoading(false)
  }
}

const loadAuthUserCount = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    const res = await fetch('/api/admin/auth-users-count', {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
      cache: 'no-store',
    })
    if (res.ok) {
      const data = await res.json()
      setAuthUserCount(data.total)
    }
  } catch {}
}

  const loadUsers = async () => {
    // On charge toujours 90j de données — periodDays filtre l'affichage des KPIs uniquement
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    const [usersRes, profilesRes, progressRes, missionsRes, convRes, postsRes] = await Promise.all([
      supabase.from('users').select('id, email, created_at'),
      supabase.from('ai_personality_profile').select('user_id, pseudo, created_at, updated_at'),
      supabase.from('program_progress').select('user_id, current_day, started_at'),
      supabase.from('mission_responses').select('user_id, completed_at').gte('completed_at', cutoff),
      supabase.from('agent_conversations').select('user_id, created_at').gte('created_at', cutoff),
      supabase.from('community_posts').select('user_id, created_at'),
    ])

    const allUsers = usersRes.data || []
    const profiles = profilesRes.data || []
    const progresses = progressRes.data || []
    const missions = missionsRes.data || []
    const convs = convRes.data || []
    const allPosts = postsRes.data || []

    const profileMap = new Map(profiles.map(p => [p.user_id, p]))
    const progressMap = new Map(progresses.map(p => [p.user_id, p]))

    const userRows: UserRow[] = allUsers.map(u => {
      const profile = profileMap.get(u.id)
      const prog = progressMap.get(u.id)
      const userMissions = missions.filter(m => m.user_id === u.id)
      const userConvs = convs.filter(c => c.user_id === u.id)
      const userPosts = allPosts.filter(post => post.user_id === u.id)

      const allActivities = [
        ...userMissions.map(m => m.completed_at),
        ...userConvs.map(c => c.created_at),
        ...userPosts.map(post => post.created_at),
      ].filter(Boolean) as string[]

      const lastActivity = allActivities.length > 0
        ? allActivities.sort().reverse()[0]
        : null

      const currentDay = prog?.current_day || 0
      const isStruggling = currentDay > 0 && (
        !lastActivity ||
        (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24) >= 4
      )

      return {
        user_id: u.id,
        pseudo: profile?.pseudo || u.email?.split('@')[0] || u.id.slice(0, 8),
        profile_created_at: u.created_at,
        current_day: currentDay,
        program_started_at: prog?.started_at || null,
        last_activity: lastActivity,
        activity_count_7d: userMissions.length + userConvs.length,
        community_posts: userPosts.length,
        agent_messages: userConvs.length,
        is_struggling: isStruggling,
      }
    })

    setUsers(userRows)
  }

  const loadChallenges = async () => {
    const { data } = await supabase
      .from('community_challenges')
      .select('*')
      .order('created_at', { ascending: false })
    if (!data) return

    const enriched = await Promise.all(data.map(async (c) => {
      const { count: total } = await supabase
        .from('challenge_participations')
        .select('*', { count: 'exact', head: true })
        .eq('challenge_id', c.id)
      const { count: completed } = await supabase
        .from('challenge_participations')
        .select('*', { count: 'exact', head: true })
        .eq('challenge_id', c.id)
        .eq('completed', true)
      return { ...c, participants_count: total || 0, completed_count: completed || 0 }
    }))
    setChallenges(enriched)
  }

  const loadPosts = async () => {
    const { data } = await supabase
      .from('community_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (!data) return

    const userIds = Array.from(new Set(data.map(p => p.user_id)))
    const { data: profiles } = await supabase
      .from('ai_personality_profile')
      .select('user_id, pseudo')
      .in('user_id', userIds)

    const pseudoMap: Record<string, string> = {}
    profiles?.forEach(p => { if (p.pseudo) pseudoMap[p.user_id] = p.pseudo })

    setPosts(data.map(p => ({
      ...p,
      pseudo: pseudoMap[p.user_id] || p.user_id.slice(0, 8),
    })))
  }

  // ─ KPIs Stats (existant) ────────────────────────────────────────────
  const total = users.length
  const onboardedCount = users.filter(u => u.profile_created_at).length
  const onProgramCount = users.filter(u => u.current_day > 0).length

  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
  const sevenDayAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const fourteenDayAgo = Date.now() - 14 * 24 * 60 * 60 * 1000
  const thirtyDayAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const fortyFiveDayAgo = Date.now() - 45 * 24 * 60 * 60 * 1000

  const periodCutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000
  const active24hCount = users.filter(u => u.last_activity && new Date(u.last_activity).getTime() > oneDayAgo).length
  const active7dCount = users.filter(u => u.last_activity && new Date(u.last_activity).getTime() > sevenDayAgo).length
  const activePeriodCount = users.filter(u => u.last_activity && new Date(u.last_activity).getTime() > periodCutoff).length
  const strugglingCount = users.filter(u => u.is_struggling).length
  const neverActiveCount = users.filter(u => !u.last_activity).length
  const communityPostsTotal = users.reduce((sum, u) => sum + u.community_posts, 0)

  const distribution = {
    j0: users.filter(u => u.current_day === 0).length,
    j1_7: users.filter(u => u.current_day >= 1 && u.current_day <= 7).length,
    j8_30: users.filter(u => u.current_day >= 8 && u.current_day <= 30).length,
    j31_60: users.filter(u => u.current_day >= 31 && u.current_day <= 60).length,
    j61_90: users.filter(u => u.current_day >= 61 && u.current_day <= 90).length,
    j90plus: users.filter(u => u.current_day > 90).length,
  }
  const maxDist = Math.max(distribution.j0, distribution.j1_7, distribution.j8_30, distribution.j31_60, distribution.j61_90, distribution.j90plus, 1)

  const filteredUsers = (() => {
    switch (selectedKpi) {
      case 'all': return users
      case 'onboarded': return users
      case 'active_24h': return users.filter(u => u.last_activity && new Date(u.last_activity).getTime() > oneDayAgo)
      case 'active_7d': return users.filter(u => u.last_activity && new Date(u.last_activity).getTime() > periodCutoff)
      case 'on_program': return users.filter(u => u.current_day > 0)
      case 'struggling': return users.filter(u => u.is_struggling)
      case 'community': return users.filter(u => u.community_posts > 0)
      case 'never_active': return users.filter(u => !u.last_activity)
      default: return users
    }
  })()

  // ─ KPIs Revue dimanche (auto Supabase) ─────────────────────────────
  const weeklySignups = users.filter(u =>
    new Date(u.profile_created_at).getTime() > sevenDayAgo
  ).length

  const j1Cohort = users.filter(u => new Date(u.profile_created_at).getTime() < oneDayAgo)
  const j1Activated = j1Cohort.filter(u => u.current_day >= 1)
  const j1Rate = j1Cohort.length > 0 ? (j1Activated.length / j1Cohort.length) * 100 : 0

  const j7Cohort = users.filter(u => {
    const t = new Date(u.profile_created_at).getTime()
    return t < sevenDayAgo && t > fourteenDayAgo
  })
  const j7Active = j7Cohort.filter(u => u.last_activity && new Date(u.last_activity).getTime() > sevenDayAgo)
  const j7Rate = j7Cohort.length > 0 ? (j7Active.length / j7Cohort.length) * 100 : 0

  const j30Cohort = users.filter(u => {
    const t = new Date(u.profile_created_at).getTime()
    return t < thirtyDayAgo && t > fortyFiveDayAgo
  })
  const j30Active = j30Cohort.filter(u => u.last_activity && new Date(u.last_activity).getTime() > sevenDayAgo)
  const j30Rate = j30Cohort.length > 0 ? (j30Active.length / j30Cohort.length) * 100 : 0

  // Phase actuelle (M1, M2, M3) basée sur la date de lancement
  const monthsSinceLaunch = (Date.now() - LAUNCH_DATE.getTime()) / (30 * 24 * 60 * 60 * 1000)
  const currentMonth: 1 | 2 | 3 = monthsSinceLaunch < 1 ? 1 : monthsSinceLaunch < 2 ? 2 : 3

  // Prochain dimanche
  const today = new Date()
  const daysToSunday = today.getDay() === 0 ? 7 : 7 - today.getDay()
  const nextSunday = new Date(today.getTime() + daysToSunday * 24 * 60 * 60 * 1000)

  const formatRelative = (dateStr: string | null) => {
    if (!dateStr) return 'Jamais'
    const diffMs = Date.now() - new Date(dateStr).getTime()
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    if (days >= 1) return `il y a ${days}j`
    if (hours >= 1) return `il y a ${hours}h`
    const mins = Math.floor(diffMs / (1000 * 60))
    return mins < 5 ? "à l'instant" : `il y a ${mins}min`
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  const formatDateTime = (dateStr: string) => new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  // ── Défis CRUD ──
  const openForm = (challenge?: Challenge) => {
    if (challenge) {
      setEditingChallenge(challenge)
      setFormData({
        title: challenge.title,
        description: challenge.description || '',
        emoji: challenge.emoji || '🎯',
        starts_at: challenge.starts_at.slice(0, 16),
        ends_at: challenge.ends_at.slice(0, 16),
        is_active: challenge.is_active,
      })
    } else {
      setEditingChallenge(null)
      const now = new Date()
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      setFormData({
        title: '', description: '', emoji: '🎯',
        starts_at: now.toISOString().slice(0, 16),
        ends_at: nextWeek.toISOString().slice(0, 16),
        is_active: true,
      })
    }
    setShowForm(true)
  }

  const saveChallenge = async () => {
    if (!formData.title || !formData.starts_at || !formData.ends_at) return
    setSaving(true)
    try {
      const payload = {
        title: formData.title, description: formData.description, emoji: formData.emoji,
        starts_at: new Date(formData.starts_at).toISOString(),
        ends_at: new Date(formData.ends_at).toISOString(),
        is_active: formData.is_active,
      }
      if (editingChallenge) {
        await supabase.from('community_challenges').update(payload).eq('id', editingChallenge.id)
      } else {
        await supabase.from('community_challenges').insert(payload)
      }
      setShowForm(false)
      loadChallenges()
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (challenge: Challenge) => {
    await supabase.from('community_challenges').update({ is_active: !challenge.is_active }).eq('id', challenge.id)
    setChallenges(prev => prev.map(c => c.id === challenge.id ? { ...c, is_active: !c.is_active } : c))
  }

  const deleteChallenge = async (id: string) => {
    await supabase.from('community_challenges').delete().eq('id', id)
    setChallenges(prev => prev.filter(c => c.id !== id))
    setConfirmDelete(null)
  }

  const deletePost = async (id: string) => {
    await supabase.from('community_posts').delete().eq('id', id)
    setPosts(prev => prev.filter(p => p.id !== id))
    setConfirmDelete(null)
  }

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: C.brownLight, fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>Chargement admin…</p>
      </div>
    )
  }

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background:
          'radial-gradient(ellipse at 20% 0%, #F8E6DB 0%, transparent 55%),' +
          'radial-gradient(ellipse at 80% 100%, #EBD7E0 0%, transparent 60%),' +
          'linear-gradient(180deg, #FBF4EC 0%, #F8F1E5 55%, #F3E9DF 100%)',
      }} />

      <div style={{ minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", color: C.brown, position: 'relative', zIndex: 2 }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(180deg, rgba(240,201,208,0.97) 0%, rgba(233,186,196,0.92) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(225,170,180,0.45)',
          boxShadow: '0 4px 18px rgba(160,110,120,0.12)',
          padding: '12px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: C.copperDark, fontWeight: 600 }}>NOVAÉ</span>
            <span style={{ fontSize: 11, color: C.brownLight, marginLeft: 10, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Admin</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: C.brownLight }}>{user?.email}</span>
            <button onClick={loadAll} style={{
              background: 'rgba(196,149,106,0.15)', border: '1px solid rgba(196,149,106,0.35)',
              borderRadius: 8, padding: '6px 12px', color: C.copperDark, fontSize: 12,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              ↻ Actualiser
            </button>
            <Link href="/" style={{
              background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(212,165,116,0.3)',
              borderRadius: 8, padding: '6px 12px', color: C.brownLight, fontSize: 12,
              textDecoration: 'none',
            }}>
              ← App
            </Link>
          </div>
        </div>

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 20px 60px' }}>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
            {[
              { id: 'stats',      label: '📊 Stats',    bg: 'rgba(197,211,180,0.35)', border: 'rgba(167,189,144,0.5)', active: '#5C7044' },
              { id: 'challenges', label: '🎯 Défis',    bg: 'rgba(242,194,182,0.35)', border: 'rgba(223,160,143,0.5)', active: '#B5654A' },
              { id: 'posts',      label: '💬 Posts',    bg: 'rgba(212,196,226,0.35)', border: 'rgba(185,162,212,0.5)', active: '#7E63A8' },
              { id: 'review',     label: '✦ Revue',     bg: 'rgba(242,194,182,0.35)', border: 'rgba(223,160,143,0.5)', active: '#B5654A' },
              { id: 'landing',    label: '📈 Landing',  bg: 'rgba(245,216,155,0.35)', border: 'rgba(231,192,111,0.5)', active: '#A8852E' },
              { id: 'audience',   label: '👥 Audience', bg: 'rgba(197,211,180,0.35)', border: 'rgba(167,189,144,0.5)', active: '#5C7044' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                style={{
                  padding: '8px 16px', borderRadius: 12,
                  background: activeTab === tab.id ? (tab as any).active : (tab as any).bg,
                  color: activeTab === tab.id ? '#fff' : C.brownLight,
                  fontSize: 12, fontWeight: activeTab === tab.id ? 700 : 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${(tab as any).border}`,
                  boxShadow: activeTab === tab.id ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ─── STATS ─── */}
          {activeTab === 'stats' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, color: C.brown, margin: 0, fontWeight: 500 }}>Vue d'ensemble</h2>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: C.brownLight, marginRight: 4 }}>Période :</span>
                  {[1, 7, 14, 30, 90].map(d => (
                    <button key={d} onClick={() => { setPeriodDays(d); loadUsers() }}
                      style={{ padding: '3px 9px', borderRadius: 7, border: `1px solid ${periodDays === d ? 'rgba(196,149,106,0.8)' : 'rgba(196,149,106,0.3)'}`, background: periodDays === d ? C.copper : 'transparent', color: periodDays === d ? '#fff' : C.copperDark, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {d === 1 ? '24h' : `${d}j`}
                    </button>
                  ))}
                </div>
              </div>
              <p style={{ fontSize: 12, color: C.brownLight, margin: '0 0 20px', fontStyle: 'italic' }}>Clique sur une tuile pour filtrer le tableau ci-dessous.</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
                <KpiTile 
  selected={selectedKpi === 'all'} 
  onClick={() => setSelectedKpi('all')} 
  emoji="👥" 
  label="Inscrites total" 
  value={authUserCount ?? total} 
  accent={C.copperDark}
  sub={authUserCount !== null && authUserCount !== total ? `${total} avec profil créé` : undefined}
/>
<KpiTile 
  selected={selectedKpi === 'onboarded'} 
  onClick={() => setSelectedKpi('onboarded')} 
  emoji="✦" 
  label="Onboarding fait" 
  value={onboardedCount} 
  accent={C.copper} 
  sub={authUserCount && authUserCount > 0 ? `${Math.round((onboardedCount / authUserCount) * 100)}% conversion` : undefined} 
/>
<KpiTile selected={selectedKpi === 'active_24h'} onClick={() => setSelectedKpi('active_24h')} emoji="🔥" label="Actives 24h" value={active24hCount} accent={C.red} sub={total > 0 ? `${Math.round((active24hCount / total) * 100)}%` : undefined} />
                <KpiTile selected={selectedKpi === 'active_7d'} onClick={() => setSelectedKpi('active_7d')} emoji="✨" label={`Actives ${periodDays === 1 ? '24h' : periodDays + 'j'}`} value={activePeriodCount} accent={C.green} sub={total > 0 ? `${Math.round((activePeriodCount / total) * 100)}%` : undefined} />
                <KpiTile selected={selectedKpi === 'on_program'} onClick={() => setSelectedKpi('on_program')} emoji="🎯" label="Programme actif" value={onProgramCount} accent={C.purple} />
                <KpiTile selected={selectedKpi === 'struggling'} onClick={() => setSelectedKpi('struggling')} emoji="🌙" label="Mode traversée" value={strugglingCount} accent={C.brownMid} sub="inactives 4j+" />
                <KpiTile selected={selectedKpi === 'community'} onClick={() => setSelectedKpi('community')} emoji="💬" label="Posts communauté" value={communityPostsTotal} accent={C.purple} sub={`par ${users.filter(u => u.community_posts > 0).length} utilisatrices`} />
                <KpiTile selected={selectedKpi === 'never_active'} onClick={() => setSelectedKpi('never_active')} emoji="💤" label="Jamais actives" value={neverActiveCount} accent={C.brownLight} sub="aucune trace" />
              </div>

              <div style={glassCard}>
                <h3 style={sectionTitle}>Distribution programme 90j</h3>
                <p style={sectionDesc}>Combien d'utilisatrices à chaque étape du parcours.</p>
                <div style={{ display: 'grid', gap: 10 }}>
                  {[
                    { label: 'Pas démarré (J0)', value: distribution.j0, color: C.brownLight },
                    { label: 'Phase 1 — Reprogrammation (J1–7)', value: distribution.j1_7, color: C.copper },
                    { label: 'Phase 1 — Reprogrammation (J8–30)', value: distribution.j8_30, color: C.copperDark },
                    { label: 'Phase 2 — Action & Discipline (J31–60)', value: distribution.j31_60, color: C.purple },
                    { label: 'Phase 3 — Expansion (J61–90)', value: distribution.j61_90, color: C.green },
                    { label: 'Programme terminé (J90+)', value: distribution.j90plus, color: '#c9a864' },
                  ].map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: '0 0 220px', fontSize: 12, color: C.brownLight }}>{d.label}</div>
                      <div style={{ flex: 1, height: 22, background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(212,165,116,0.2)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ width: `${(d.value / maxDist) * 100}%`, height: '100%', background: `linear-gradient(90deg, ${d.color}, ${d.color}cc)`, transition: 'width 0.6s ease' }} />
                      </div>
                      <div style={{ flex: '0 0 30px', textAlign: 'right', fontSize: 14, fontWeight: 700, color: C.brown }}>{d.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={glassCard}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h3 style={sectionTitle}>
                    Utilisatrices <span style={{ color: C.brownLight, fontWeight: 400, fontSize: 14 }}>({filteredUsers.length})</span>
                  </h3>
                  {selectedKpi !== 'all' && (
                    <button onClick={() => setSelectedKpi('all')} style={{
                      background: 'rgba(196,149,106,0.15)', border: '1px solid rgba(196,149,106,0.3)',
                      borderRadius: 8, padding: '4px 10px', color: C.copperDark, fontSize: 11,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>← Toutes</button>
                  )}
                </div>

                {filteredUsers.length === 0 ? (
                  <p style={{ fontSize: 13, color: C.brownLight, padding: '20px 0', textAlign: 'center' }}>Aucune utilisatrice dans cette catégorie.</p>
                ) : (
                  <div style={{ overflowX: 'auto', marginTop: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(212,165,116,0.3)' }}>
                          <th style={th}>Pseudo</th>
                          <th style={th}>Inscription</th>
                          <th style={th}>Jour</th>
                          <th style={th}>Dernière activité</th>
                          <th style={th}>Posts</th>
                          <th style={th}>Msg IA (7j)</th>
                          <th style={th}>Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers
                          .sort((a, b) => {
                            const ta = a.last_activity ? new Date(a.last_activity).getTime() : 0
                            const tb = b.last_activity ? new Date(b.last_activity).getTime() : 0
                            return tb - ta
                          })
                          .map(u => {
                            let statusBadge: { label: string; color: string; bg: string }
                            if (!u.last_activity) {
                              statusBadge = { label: 'Inactive', color: C.brownLight, bg: 'rgba(107,83,64,0.12)' }
                            } else if (u.is_struggling) {
                              statusBadge = { label: '🌙 Traversée', color: C.copperDark, bg: 'rgba(196,149,106,0.18)' }
                            } else if (new Date(u.last_activity).getTime() > oneDayAgo) {
                              statusBadge = { label: '🔥 Active', color: C.red, bg: 'rgba(196,74,74,0.15)' }
                            } else {
                              statusBadge = { label: 'Engagée', color: C.green, bg: 'rgba(123,168,105,0.15)' }
                            }
                            return (
                              <tr key={u.user_id} style={{ borderBottom: '1px solid rgba(212,165,116,0.15)' }}>
                                <td style={td}><span style={{ fontWeight: 600, color: C.brown }}>{u.pseudo}</span></td>
                                <td style={td}>{formatDate(u.profile_created_at)}</td>
                                <td style={td}>{u.current_day === 0 ? <span style={{ color: C.brownLight }}>—</span> : <strong>J{u.current_day}/90</strong>}</td>
                                <td style={td}>{formatRelative(u.last_activity)}</td>
                                <td style={td}>{u.community_posts}</td>
                                <td style={td}>{u.agent_messages}</td>
                                <td style={td}>
                                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: statusBadge.bg, color: statusBadge.color }}>
                                    {statusBadge.label}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── AUDIENCE ─── */}
          {activeTab === 'audience' && (
            <div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, color: C.brown, margin: '0 0 6px', fontWeight: 500 }}>
                Audience & Démographie
              </h2>
              <p style={{ fontSize: 13, color: C.brownLight, margin: '0 0 24px' }}>
                Données anonymisées — {audienceData?.total ?? '…'} profils •{' '}
                <strong style={{ color: C.green }}>{audienceData?.consenties ?? '…'} consenties</strong> aux partenariats
              </p>

              {!audienceData ? (
                <p style={{ color: C.brownLight, fontSize: 13 }}>Chargement…</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>

                  {/* Tranche d'âge */}
                  <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(61,38,24,0.07)' }}>
                    <h3 style={{ ...sectionTitle, marginBottom: 14 }}>🎂 Tranche d'âge</h3>
                    {audienceData.demographie.map((r: any) => {
                      const pct = Math.round((r.count / audienceData.total) * 100)
                      return (
                        <div key={r.tranche_age} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                            <span style={{ color: C.brown, fontWeight: 500 }}>{r.tranche_age}</span>
                            <span style={{ color: C.brownLight }}>{r.count} ({pct}%)</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: 'rgba(196,149,106,0.15)' }}>
                            <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: 'linear-gradient(90deg, #c4956a, #d4a574)' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Localisation */}
                  <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(61,38,24,0.07)' }}>
                    <h3 style={{ ...sectionTitle, marginBottom: 14 }}>📍 Localisation</h3>
                    {audienceData.localisation.slice(0, 8).map((r: any) => {
                      const pct = Math.round((r.count / audienceData.total) * 100)
                      return (
                        <div key={r.localisation} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                            <span style={{ color: C.brown, fontWeight: 500 }}>{r.localisation}</span>
                            <span style={{ color: C.brownLight }}>{r.count} ({pct}%)</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: 'rgba(196,149,106,0.15)' }}>
                            <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: 'linear-gradient(90deg, #7ba869, #a8c896)' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Enfants */}
                  <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(61,38,24,0.07)' }}>
                    <h3 style={{ ...sectionTitle, marginBottom: 14 }}>👧 Situation familiale</h3>
                    {audienceData.a_enfants.map((r: any) => {
                      const pct = Math.round((r.count / audienceData.total) * 100)
                      return (
                        <div key={r.a_enfants} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                            <span style={{ color: C.brown, fontWeight: 500 }}>{r.a_enfants === 'oui' ? 'Avec enfants' : r.a_enfants === 'non' ? 'Sans enfants' : r.a_enfants}</span>
                            <span style={{ color: C.brownLight }}>{r.count} ({pct}%)</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: 'rgba(196,149,106,0.15)' }}>
                            <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: 'linear-gradient(90deg, #7B6FA0, #a89ec8)' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Secteur */}
                  <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(61,38,24,0.07)' }}>
                    <h3 style={{ ...sectionTitle, marginBottom: 14 }}>💼 Secteur d'activité</h3>
                    {audienceData.secteur.slice(0, 8).map((r: any) => {
                      const pct = Math.round((r.count / audienceData.total) * 100)
                      return (
                        <div key={r.secteur_activite} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                            <span style={{ color: C.brown, fontWeight: 500 }}>{r.secteur_activite}</span>
                            <span style={{ color: C.brownLight }}>{r.count} ({pct}%)</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: 'rgba(196,149,106,0.15)' }}>
                            <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: 'linear-gradient(90deg, #c44a4a, #d47070)' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Modules les plus utilisés */}
                  <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(61,38,24,0.07)', gridColumn: 'span 2' }}>
                    <h3 style={{ ...sectionTitle, marginBottom: 4 }}>📱 Modules les plus utilisés</h3>
                    <p style={{ fontSize: 11, color: C.brownLight, margin: '0 0 14px' }}>Basé sur les événements enregistrés — utile pour cibler les partenariats</p>
                    {audienceData.modules.length === 0 ? (
                      <p style={{ fontSize: 12, color: C.brownLight }}>Aucun événement module enregistré pour l'instant — les données s'accumulent au fil des connexions.</p>
                    ) : (
                      audienceData.modules.map((r, i) => {
                        const max = audienceData.modules[0]?.count || 1
                        const pct = Math.round((r.count / max) * 100)
                        const label = r.event_type.replace('module_', '').charAt(0).toUpperCase() + r.event_type.replace('module_', '').slice(1)
                        const partnerMap: Record<string, string> = {
                          recettes: '🍽️ Alimentation / meal kits',
                          programme: '🧠 Coaching / bien-être / psy',
                          routines: '✨ Beauté / compléments / wellness',
                          planner: '📒 Productivité / papeterie',
                          famille: '👨‍👩‍👧 Parentalité / services famille',
                          agent: '🤖 Tech / coaching digital',
                          tracker: '📊 Santé / suivi perso',
                          defis: '🎯 Sport / développement perso',
                          notes: '📝 Productivité / journaling',
                          astuces: '💡 Lifestyle / conseils pratiques',
                          communaute: '💬 Communauté / réseaux',
                        }
                        const moduleKey = r.event_type.replace('module_', '')
                        return (
                          <div key={r.event_type} style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                              <span style={{ color: C.brown, fontWeight: 600 }}>{label}</span>
                              <span style={{ color: C.brownLight }}>{r.count} sessions • {partnerMap[moduleKey] || ''}</span>
                            </div>
                            <div style={{ height: 8, borderRadius: 4, background: 'rgba(196,149,106,0.15)' }}>
                              <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: i === 0 ? 'linear-gradient(90deg, #c4956a, #d4a574)' : 'linear-gradient(90deg, #a8836a, #c4a58a)' }} />
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                </div>
              )}
            </div>
          )}

          {/* ─── DÉFIS ─── */}
          {activeTab === 'challenges' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, color: C.brown, margin: 0, fontWeight: 500 }}>Défis communauté</h2>
                <button onClick={() => openForm()} style={{
                  padding: '10px 18px',
                  background: 'linear-gradient(135deg, #c4956a, #8b5a3c)',
                  border: 'none', borderRadius: 12, color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 4px 12px rgba(139, 90, 60, 0.2)',
                }}>+ Nouveau défi</button>
              </div>

              {challenges.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: C.brownLight }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
                  <p>Aucun défi créé. Lance le premier !</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {challenges.map(challenge => (
                    <div key={challenge.id} style={{
                      ...glassCard, marginBottom: 0, padding: '16px 18px',
                      borderColor: challenge.is_active ? 'rgba(196,149,106,0.5)' : 'rgba(255,255,255,0.5)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                        <span style={{ fontSize: 32, flexShrink: 0 }}>{challenge.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.brown }}>{challenge.title}</h3>
                            <span style={{
                              fontSize: 10, padding: '2px 8px', borderRadius: 20,
                              background: challenge.is_active ? 'rgba(123,168,105,0.18)' : 'rgba(107,83,64,0.1)',
                              color: challenge.is_active ? C.green : C.brownLight,
                              border: `1px solid ${challenge.is_active ? 'rgba(123,168,105,0.3)' : 'rgba(107,83,64,0.18)'}`,
                              fontWeight: 700,
                            }}>{challenge.is_active ? '● Actif' : '○ Inactif'}</span>
                          </div>
                          {challenge.description && <p style={{ margin: '0 0 8px', fontSize: 13, color: C.brownLight, lineHeight: 1.5 }}>{challenge.description}</p>}
                          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: C.brownLight, flexWrap: 'wrap' }}>
                            <span>📅 {formatDate(challenge.starts_at)} → {formatDate(challenge.ends_at)}</span>
                            <span>👥 {challenge.participants_count} participantes</span>
                            <span>✅ {challenge.completed_count} complétés</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                          <button onClick={() => toggleActive(challenge)} style={smallBtn}>{challenge.is_active ? 'Désactiver' : 'Activer'}</button>
                          <button onClick={() => openForm(challenge)} style={{ ...smallBtn, color: C.copperDark, borderColor: 'rgba(196,149,106,0.4)' }}>✏️</button>
                          <button onClick={() => setConfirmDelete(challenge.id)} style={{ ...smallBtn, color: C.red, borderColor: 'rgba(196,74,74,0.3)' }}>🗑️</button>
                        </div>
                      </div>
                      {confirmDelete === challenge.id && (
                        <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(196,74,74,0.1)', border: '1px solid rgba(196,74,74,0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 13, color: C.red, flex: 1 }}>Confirmer la suppression de ce défi ?</span>
                          <button onClick={() => deleteChallenge(challenge.id)} style={{ ...smallBtn, background: C.red, color: '#fff', borderColor: C.red }}>Supprimer</button>
                          <button onClick={() => setConfirmDelete(null)} style={smallBtn}>Annuler</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── POSTS ─── */}
          {activeTab === 'posts' && (
            <div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, color: C.brown, margin: '0 0 20px', fontWeight: 500 }}>Modération des posts</h2>
              {posts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: C.brownLight }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
                  <p>Aucun post dans la communauté.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {posts.map(post => (
                    <div key={post.id} style={{ ...glassCard, marginBottom: 0, padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #c4956a, #8b5a3c)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                          {post.pseudo?.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.copperDark }}>{post.pseudo}</span>
                            <span style={{ fontSize: 11, color: C.brownLight }}>{formatDateTime(post.created_at)}</span>
                            <span style={{ fontSize: 11, color: C.brownLight }}>💛 {post.likes_count} · 💬 {post.comments_count}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: 13, color: C.brown, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{post.content}</p>
                        </div>
                        <button onClick={() => setConfirmDelete('post_' + post.id)} style={{ ...smallBtn, color: C.red, borderColor: 'rgba(196,74,74,0.3)', flexShrink: 0 }}>🗑️</button>
                      </div>
                      {confirmDelete === 'post_' + post.id && (
                        <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(196,74,74,0.1)', border: '1px solid rgba(196,74,74,0.25)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 12, color: C.red, flex: 1 }}>Supprimer ce post ?</span>
                          <button onClick={() => deletePost(post.id)} style={{ ...smallBtn, background: C.red, color: '#fff', borderColor: C.red }}>Supprimer</button>
                          <button onClick={() => setConfirmDelete(null)} style={smallBtn}>Annuler</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── REVUE DIMANCHE ─── */}
          {activeTab === 'review' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6, gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, color: C.brown, margin: 0, fontWeight: 500 }}>Revue du dimanche</h2>
                  <p style={{ fontSize: 12, color: C.brownLight, margin: '4px 0 0', fontStyle: 'italic' }}>
                    Tableau 10.4 du dossier V2 Pro · Phase actuelle : <strong>M{currentMonth}</strong>
                  </p>
                </div>
                <div style={{ textAlign: 'right', fontSize: 11, color: C.brownLight }}>
                  <div>Aujourd'hui : <strong style={{ color: C.brown }}>{formatDate(today.toISOString())}</strong></div>
                  <div style={{ marginTop: 2 }}>Prochain dimanche : <strong style={{ color: C.copperDark }}>{formatDate(nextSunday.toISOString())}</strong></div>
                  {lastReviewAt && (
                    <div style={{ marginTop: 2, opacity: 0.8 }}>Dernière saisie : {formatRelative(lastReviewAt)}</div>
                  )}
                </div>
              </div>

              {/* Section 1 — Auto Supabase */}
              <div style={{ ...glassCard, marginTop: 20 }}>
                <h3 style={sectionTitle}>📊 KPIs automatiques (Supabase)</h3>
                <p style={sectionDesc}>Calculés en temps réel à partir de tes tables. Cible <strong>M{currentMonth}</strong> + alerte selon le tableau 10.4.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                  <ReviewKpi
                    label="Nouvelles inscriptions / sem"
                    source="Supabase ai_personality_profile"
                    value={weeklySignups}
                    unit=""
                    targetByMonth={[25, 50, 75]}
                    alert={10}
                    higherIsBetter
                    currentMonth={currentMonth}
                    sub={`${total} inscrites au total`}
                  />
                  <ReviewKpi
                    label="J1 Activation"
                    source="Supabase program_progress"
                    value={j1Rate}
                    unit="%"
                    targetByMonth={[30, 40, 50]}
                    alert={20}
                    higherIsBetter
                    currentMonth={currentMonth}
                    sub={`${j1Activated.length}/${j1Cohort.length} cohorte 24h+`}
                  />
                  <ReviewKpi
                    label="J7 Retention"
                    source="Supabase activity 7-14j"
                    value={j7Rate}
                    unit="%"
                    targetByMonth={[20, 30, 40]}
                    alert={15}
                    higherIsBetter
                    currentMonth={currentMonth}
                    sub={j7Cohort.length === 0 ? 'cohorte vide' : `${j7Active.length}/${j7Cohort.length} cohorte 7-14j`}
                  />
                  <ReviewKpi
                    label="J30 Retention"
                    source="Supabase activity 30-45j"
                    value={j30Rate}
                    unit="%"
                    targetByMonth={[12, 18, 25]}
                    alert={8}
                    higherIsBetter
                    currentMonth={currentMonth}
                    sub={j30Cohort.length === 0 ? 'cohorte vide (trop tôt)' : `${j30Active.length}/${j30Cohort.length} cohorte 30-45j`}
                  />
                  <ReviewKpi
                    label="Streak moyen"
                    source="Supabase user_streaks"
                    value={avgStreak}
                    unit="j"
                    targetByMonth={[5, 8, 12]}
                    alert={3}
                    higherIsBetter
                    currentMonth={currentMonth}
                    sub={`sur ${streakCount} streaks actifs`}
                  />
                </div>
              </div>

              {/* Section 2 — Manuel Stripe */}
              <div style={glassCard}>
                <h3 style={sectionTitle}>💳 Monétisation (Stripe — saisie manuelle)</h3>
                <p style={sectionDesc}>À récupérer dans ton dashboard Stripe chaque dimanche. Auto-sauvegardé.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                  <ReviewKpi
                    label="Conversion free → premium"
                    source="Stripe Dashboard"
                    isManual
                    manualValue={manualKpis.conversion}
                    onManualChange={v => updateManualKpi('conversion', v)}
                    unit="%"
                    targetByMonth={[2, 5, 8]}
                    alert={1}
                    higherIsBetter
                    currentMonth={currentMonth}
                  />
                  <ReviewKpi
                    label="MRR"
                    source="Stripe Dashboard"
                    isManual
                    manualValue={manualKpis.mrr}
                    onManualChange={v => updateManualKpi('mrr', v)}
                    unit="€"
                    targetByMonth={[50, 200, 500]}
                    alert={0}
                    higherIsBetter
                    currentMonth={currentMonth}
                    sub="cible cumulée"
                  />
                  <ReviewKpi
                    label="Churn mensuel"
                    source="Stripe Dashboard"
                    isManual
                    manualValue={manualKpis.churn}
                    onManualChange={v => updateManualKpi('churn', v)}
                    unit="%"
                    targetByMonth={[15, 10, 5]}
                    alert={20}
                    higherIsBetter={false}
                    currentMonth={currentMonth}
                    sub="cible : INFÉRIEUR à"
                  />
                </div>
              </div>

              {/* Section 3 — Manuel Marketing */}
              <div style={glassCard}>
                <h3 style={sectionTitle}>📱 Marketing (TikTok / Brevo — saisie manuelle)</h3>
                <p style={sectionDesc}>À récupérer dans TikTok Studio et Brevo chaque dimanche.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                  <ReviewKpi
                    label="Vues TikTok / vidéo (moy.)"
                    source="TikTok Studio"
                    isManual
                    manualValue={manualKpis.tiktokViews}
                    onManualChange={v => updateManualKpi('tiktokViews', v)}
                    unit=""
                    targetByMonth={[5000, 10000, 20000]}
                    alert={1000}
                    higherIsBetter
                    currentMonth={currentMonth}
                  />
                  <ReviewKpi
                    label="CTR lien bio"
                    source="TikTok Studio"
                    isManual
                    manualValue={manualKpis.ctrBio}
                    onManualChange={v => updateManualKpi('ctrBio', v)}
                    unit="%"
                    targetByMonth={[2, 4, 6]}
                    alert={1}
                    higherIsBetter
                    currentMonth={currentMonth}
                  />
                  <ReviewKpi
                    label="Taux ouverture email"
                    source="Auto Brevo (7j)"
                    value={brevoStats?.computed?.openRate}
                    unit="%"
                    targetByMonth={[30, 38, 45]}
                    alert={20}
                    higherIsBetter
                    currentMonth={currentMonth}
                    sub={
                      brevoLoading ? 'Chargement…' :
                      brevoError ? `Erreur : ${brevoError}` :
                      brevoStats ? `${brevoStats.raw.uniqueOpens} ouvertures / ${brevoStats.raw.delivered} envoyés` :
                      'Aucune donnée'
                    }
                  />
                  <ReviewKpi
                    label="K-factor referral"
                    source="Manuel — formule dossier"
                    isManual
                    manualValue={manualKpis.kFactor}
                    onManualChange={v => updateManualKpi('kFactor', v)}
                    unit=""
                    targetByMonth={[0.1, 0.2, 0.3]}
                    alert={0.05}
                    higherIsBetter
                    currentMonth={currentMonth}
                    sub="invitations / inscriptions"
                  />
                </div>
              </div>
              

              {/* Section 3 bis — Détail Brevo auto-fetché */}
              <div style={{display:"none"}}><div style={glassCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <h3 style={sectionTitle}>📧 Stats Brevo détaillées (7 derniers jours)</h3>
                    <p style={sectionDesc}>
                      Récupéré automatiquement via l'API Brevo. {brevoStats?.period && `Période : ${brevoStats.period.startDate} → ${brevoStats.period.endDate}.`}
                    </p>
                  </div>
                  <button
                    onClick={loadBrevoStats}
                    disabled={brevoLoading}
                    style={{
                      background: 'rgba(196,149,106,0.15)', border: '1px solid rgba(196,149,106,0.35)',
                      borderRadius: 8, padding: '6px 12px', color: C.copperDark, fontSize: 12,
                      cursor: brevoLoading ? 'wait' : 'pointer', fontFamily: 'inherit', flexShrink: 0,
                    }}
                  >
                    {brevoLoading ? '…' : '↻ Recharger'}
                  </button>
                </div>

                {brevoLoading && !brevoStats ? (
                  <p style={{ fontSize: 12, color: C.brownLight, padding: '16px 0' }}>Chargement des stats Brevo…</p>
                ) : brevoError && !brevoStats ? (
                  <div style={{ padding: '14px 16px', background: 'rgba(196,74,74,0.08)', border: '1px solid rgba(196,74,74,0.25)', borderRadius: 10 }}>
                    <p style={{ fontSize: 13, color: C.red, margin: 0, fontWeight: 600 }}>Impossible de joindre Brevo</p>
                    <p style={{ fontSize: 11, color: C.brownLight, margin: '4px 0 0' }}>{brevoError}</p>
                    <p style={{ fontSize: 11, color: C.brownLight, margin: '4px 0 0', fontStyle: 'italic' }}>
                      Vérifie que <code>BREVO_API_KEY</code> est bien configurée sur Vercel et que le déploiement est à jour.
                    </p>
                  </div>
                ) : brevoStats ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                    <BrevoCell label="Emails envoyés" value={brevoStats.raw.requests.toLocaleString('fr-FR')} />
                    <BrevoCell
                      label="Délivrés"
                      value={brevoStats.raw.delivered.toLocaleString('fr-FR')}
                      sub={`${brevoStats.computed.deliveryRate.toFixed(1)}% de livraison`}
                      accent={brevoStats.computed.deliveryRate >= 95 ? 'green' : brevoStats.computed.deliveryRate >= 90 ? 'yellow' : 'red'}
                    />
                    <BrevoCell
                      label="Ouvertures uniques"
                      value={brevoStats.raw.uniqueOpens.toLocaleString('fr-FR')}
                      sub={`${brevoStats.computed.openRate.toFixed(1)}% taux d'ouverture`}
                      accent={brevoStats.computed.openRate >= 30 ? 'green' : brevoStats.computed.openRate >= 20 ? 'yellow' : 'red'}
                    />
                    <BrevoCell
                      label="Clics uniques"
                      value={brevoStats.raw.uniqueClicks.toLocaleString('fr-FR')}
                      sub={`${brevoStats.computed.clickRate.toFixed(1)}% taux de clic`}
                      accent={brevoStats.computed.clickRate >= 3 ? 'green' : brevoStats.computed.clickRate >= 1 ? 'yellow' : 'red'}
                    />
                    <BrevoCell
                      label="Bounces totaux"
                      value={brevoStats.raw.totalBounces.toLocaleString('fr-FR')}
                      sub={`${brevoStats.computed.bounceRate.toFixed(1)}% taux de bounce`}
                      accent={brevoStats.computed.bounceRate <= 2 ? 'green' : brevoStats.computed.bounceRate <= 5 ? 'yellow' : 'red'}
                    />
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: C.brownLight, padding: '16px 0' }}>Aucune donnée disponible.</p>
                )}
              </div>

<BrevoEventsTable />

              {/* Section 4 — Roadmap interactive */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 16 }}>
  <h3 style={{ ...sectionTitle, margin: 0 }}>📌 Roadmap vivante</h3>
  <button onClick={resetRoadmap} style={{
    background: 'transparent', border: 'none', color: C.brownLight,
    fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
    textDecoration: 'underline', opacity: 0.7,
  }}>
    ↺ Réinitialiser
  </button>
</div>

<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>

  {/* Validé */}
  <div style={{ ...glassCard, marginBottom: 0, borderColor: 'rgba(123,168,105,0.4)' }}>
    <h3 style={{ ...sectionTitle, color: C.green }}>✅ Validé en prod</h3>
    {Object.entries(roadmapData.validated).map(([category, items]) => (
      <div key={category} style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.copperDark, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          {category}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '3px 0', fontSize: 12, color: C.brown, lineHeight: 1.5 }}>
              <button onClick={() => toggleItem('validated', category, item)} title="Remettre en attente"
                style={{ background: 'rgba(123,168,105,0.15)', border: '1px solid rgba(123,168,105,0.4)', cursor: 'pointer', padding: 0, width: 16, height: 16, borderRadius: 4, fontSize: 11, color: C.green, flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                ✓
              </button>
              <span style={{ flex: 1 }}>{item}</span>
              <button onClick={() => removeItem('validated', category, item)} title="Supprimer"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontSize: 14, color: C.brownLight, flexShrink: 0, opacity: 0.4 }}>
                ×
              </button>
            </div>
          ))}
          {adding?.column === 'validated' && adding?.category === category ? (
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <input autoFocus value={newItemText} onChange={e => setNewItemText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addItem('validated', category); if (e.key === 'Escape') { setAdding(null); setNewItemText('') } }}
                placeholder="Nouvel item…"
                style={{ flex: 1, fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(123,168,105,0.4)', background: '#faf7f2', color: C.brown, fontFamily: 'inherit', outline: 'none' }} />
              <button onClick={() => addItem('validated', category)} style={{ ...smallBtn, padding: '2px 8px', fontSize: 12 }}>✓</button>
              <button onClick={() => { setAdding(null); setNewItemText('') }} style={{ ...smallBtn, padding: '2px 8px', fontSize: 12 }}>×</button>
            </div>
          ) : (
            <button onClick={() => setAdding({ column: 'validated', category })}
              style={{ background: 'none', border: 'none', color: C.green, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', padding: '4px 0 0', opacity: 0.7 }}>
              + Ajouter
            </button>
          )}
        </div>
      </div>
    ))}
  </div>

  {/* En attente */}
  <div style={{ ...glassCard, marginBottom: 0, borderColor: 'rgba(212,167,56,0.4)' }}>
    <h3 style={{ ...sectionTitle, color: C.copperDark }}>⏳ En attente</h3>
    {Object.entries(roadmapData.pending).map(([category, items]) => (
      <div key={category} style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.copperDark, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          {category}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '3px 0', fontSize: 12, color: C.brown, lineHeight: 1.5 }}>
              <button onClick={() => toggleItem('pending', category, item)} title="Marquer comme validé"
                style={{ background: '#faf7f2', border: '1px solid rgba(212,165,116,0.5)', cursor: 'pointer', padding: 0, width: 16, height: 16, borderRadius: 4, fontSize: 11, color: 'transparent', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✓
              </button>
              <span style={{ flex: 1 }}>{item}</span>
              <button onClick={() => removeItem('pending', category, item)} title="Supprimer"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontSize: 14, color: C.brownLight, flexShrink: 0, opacity: 0.4 }}>
                ×
              </button>
            </div>
          ))}
          {adding?.column === 'pending' && adding?.category === category ? (
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <input autoFocus value={newItemText} onChange={e => setNewItemText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addItem('pending', category); if (e.key === 'Escape') { setAdding(null); setNewItemText('') } }}
                placeholder="Nouvel item…"
                style={{ flex: 1, fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(212,165,116,0.4)', background: '#faf7f2', color: C.brown, fontFamily: 'inherit', outline: 'none' }} />
              <button onClick={() => addItem('pending', category)} style={{ ...smallBtn, padding: '2px 8px', fontSize: 12 }}>✓</button>
              <button onClick={() => { setAdding(null); setNewItemText('') }} style={{ ...smallBtn, padding: '2px 8px', fontSize: 12 }}>×</button>
            </div>
          ) : (
            <button onClick={() => setAdding({ column: 'pending', category })}
              style={{ background: 'none', border: 'none', color: C.copperDark, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', padding: '4px 0 0', opacity: 0.7 }}>
              + Ajouter
            </button>
          )}
        </div>
      </div>
    ))}
  </div>

</div>

              </div>
              <p style={{ fontSize: 11, color: C.brownLight, fontStyle: 'italic', marginTop: 20, textAlign: 'center' }}>
                ✦ Les saisies manuelles sont sauvegardées automatiquement dans ton navigateur. Pense à les actualiser chaque dimanche.
                 </p>
            </div>
          )}

          {activeTab === 'landing' && (
  <div>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6, gap: 12, flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, color: C.brown, margin: 0, fontWeight: 500 }}>
          Landing page
        </h2>
        <p style={{ fontSize: 12, color: C.brownLight, margin: '4px 0 0', fontStyle: 'italic' }}>
          Trafic et clics sur novae-by-omanaia.com · 30 derniers jours
        </p>
      </div>
      <button
        onClick={loadLandingStats}
        disabled={landingLoading}
        style={{
          background: 'rgba(196,149,106,0.15)',
          border: '1px solid rgba(196,149,106,0.35)',
          borderRadius: 8, padding: '6px 12px',
          color: C.copperDark, fontSize: 12,
          cursor: landingLoading ? 'wait' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {landingLoading ? '…' : '↻ Recharger'}
      </button>
    </div>
 
    {landingLoading && !landingStats ? (
      <div style={{ ...glassCard, textAlign: 'center', padding: '40px 20px' }}>
        <p style={{ fontSize: 13, color: C.brownLight }}>Chargement des stats landing…</p>
      </div>
    ) : landingError && !landingStats ? (
      <div style={{ ...glassCard, padding: '20px', background: 'rgba(196,74,74,0.06)', borderColor: 'rgba(196,74,74,0.25)' }}>
        <p style={{ fontSize: 13, color: C.red, margin: 0, fontWeight: 600 }}>Impossible de charger les stats</p>
        <p style={{ fontSize: 11, color: C.brownLight, margin: '4px 0 0' }}>{landingError}</p>
        <p style={{ fontSize: 11, color: C.brownLight, margin: '8px 0 0', fontStyle: 'italic' }}>
          Vérifie que la migration SQL <code>landing_events</code> a bien été exécutée et que la landing pousse les events.
        </p>
      </div>
    ) : landingStats ? (
      <>
        {/* ─── KPIS PRINCIPAUX ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
          <KpiTile
            selected={false}
            onClick={() => {}}
            emoji="👁️"
            label="Vues (30j)"
            value={landingStats.pageViews.last7d}
            accent={C.copperDark}
            sub={`${landingStats.pageViews.last24h} sur 24h · ${landingStats.pageViews.total} total`}
          />
          <KpiTile
  selected={false}
  onClick={() => {}}
  emoji="👤"
  label="Visiteuses uniques (7j)"
  value={landingStats.uniqueVisitors.last7d}
  accent={C.copper}
  sub={`${landingStats.uniqueVisitors.last24h} sur 24h · ${landingStats.uniqueVisitors.total} total`}
/>
<KpiTile
  selected={false}
  onClick={() => {}}
  emoji="✦"
  label="Clics CTA total"
  value={landingStats.cta.totalClicks}
  accent={C.green}
  sub={`${landingStats.cta.totalSessions > 0 ? landingStats.cta.conversionRate.toFixed(1) : '0'}% de conversion`}
/>

        </div>
 
        {/* ─── CTA BREAKDOWN ─── */}
        <div style={glassCard}>
          <h3 style={sectionTitle}>Clics par bouton</h3>
          <p style={sectionDesc}>Quel CTA convertit le mieux. Idéal pour A/B test du copy.</p>
          {landingStats.cta.breakdown.length === 0 ? (
            <p style={{ fontSize: 13, color: C.brownLight, padding: '14px 0' }}>Aucun clic encore enregistré.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {landingStats.cta.breakdown.map((c, i) => {
                const max = landingStats.cta.breakdown[0].count
                const pct = Math.round((c.count / max) * 100)
                const labelMap: Record<string, string> = {
                  'nav_cta':       'Nav top — Avant-première gratuite',
                  'hero_primary':  'Hero — Teste le changement',
                  'hero_blog':     'Hero — Lire un article du blog',
                  'mirror_cta':    'Mirror — Teste le changement',
                  'community_cta': 'Communauté — Rejoins-les',
                  'final_primary': 'Final — Teste le changement',
                  'footer_contact': 'Footer — Contact',
                }
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: '0 0 260px', fontSize: 12, color: C.brown }}>
                      {labelMap[c.label] || c.label}
                    </div>
                    <div style={{ flex: 1, height: 22, background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(212,165,116,0.2)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${C.copper}, ${C.copperDark})`, transition: 'width 0.6s ease' }} />
                    </div>
                    <div style={{ flex: '0 0 50px', textAlign: 'right', fontSize: 14, fontWeight: 700, color: C.brown }}>{c.count}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
 
        {/* ─── FUNNEL ─── */}
        <div style={glassCard}>
          <h3 style={sectionTitle}>Funnel principal</h3>
          <p style={sectionDesc}>Combien de visiteuses ont cliqué un CTA sur les 30 derniers jours.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            <FunnelStep label="Visiteuses uniques" value={landingStats.cta.totalSessions} max={landingStats.cta.totalSessions} color={C.copperDark} />
            <FunnelStep
              label="Ont cliqué un CTA principal"
              value={landingStats.cta.sessionsClickedAnyMain}
              max={landingStats.cta.totalSessions}
              color={C.copper}
            />
            <FunnelStep
              label="Ont cliqué hero (haut de page)"
              value={landingStats.cta.sessionsClickedHero}
              max={landingStats.cta.totalSessions}
              color={C.green}
            />
            <FunnelStep
              label="Ont cliqué final (bas de page)"
              value={landingStats.cta.sessionsClickedFinal}
              max={landingStats.cta.totalSessions}
              color={C.purple}
            />
            <FunnelStep
              label="Ont fait le quiz"
              value={landingStats.cta.sessionsClickedQuiz}
              max={landingStats.cta.totalSessions}
              color={C.brown}
            />
            <FunnelStep
              label="Ont lu un article du blog"
              value={landingStats.cta.sessionsClickedBlog}
              max={landingStats.cta.totalSessions}
              color={C.brownLight}
            />
          </div>
        </div>

        {/* ─── LEADS QUIZ CHARGE MENTALE ─── */}
        <div style={glassCard}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h3 style={sectionTitle}>Leads du quiz "charge mentale"</h3>
              <p style={sectionDesc}>Emails collectés via le quiz de la landing, avec leur score et profil.</p>
            </div>
            {landingStats.quiz.leads.length > 0 && (
              <button
                onClick={() => {
                  const header = 'email,score,profil,score_label,date\n'
                  const lines = landingStats.quiz.leads.map(l =>
                    [l.email, l.score ?? '', l.profil ?? '', l.scoreLabel ?? '', l.date].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
                  )
                  const csv = header + lines.join('\n')
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `novae-leads-quiz-${new Date().toISOString().slice(0, 10)}.csv`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                style={{
                  background: 'rgba(196,149,106,0.15)',
                  border: '1px solid rgba(196,149,106,0.35)',
                  borderRadius: 8, padding: '6px 12px',
                  color: C.copperDark, fontSize: 12,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                ⬇ Exporter en CSV
              </button>
            )}
          </div>

          {landingStats.quiz.profilBreakdown.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
              {landingStats.quiz.profilBreakdown.map((p, i) => (
                <span key={i} style={{
                  fontSize: 12, padding: '4px 10px', borderRadius: 999,
                  background: 'rgba(155,90,101,0.1)', color: C.copperDark,
                  border: '1px solid rgba(155,90,101,0.2)',
                }}>
                  {p.profil} · {p.count}
                </span>
              ))}
            </div>
          )}

          {landingStats.quiz.leads.length === 0 ? (
            <p style={{ fontSize: 13, color: C.brownLight, padding: '14px 0' }}>Aucun lead encore enregistré sur cette période.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: C.brownLight, borderBottom: '1px solid rgba(212,165,116,0.25)' }}>
                    <th style={{ padding: '6px 8px' }}>Email</th>
                    <th style={{ padding: '6px 8px' }}>Score</th>
                    <th style={{ padding: '6px 8px' }}>Profil</th>
                    <th style={{ padding: '6px 8px' }}>Niveau</th>
                    <th style={{ padding: '6px 8px' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {landingStats.quiz.leads.slice(0, 50).map((l, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(212,165,116,0.12)' }}>
                      <td style={{ padding: '6px 8px', color: C.brown }}>{l.email}</td>
                      <td style={{ padding: '6px 8px' }}>{l.score ?? '–'}</td>
                      <td style={{ padding: '6px 8px' }}>{l.profil ?? '–'}</td>
                      <td style={{ padding: '6px 8px' }}>{l.scoreLabel ?? '–'}</td>
                      <td style={{ padding: '6px 8px', color: C.brownLight }}>{formatDateTime(l.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {landingStats.quiz.leads.length > 50 && (
                <p style={{ fontSize: 11, color: C.brownLight, marginTop: 8, fontStyle: 'italic' }}>
                  Affichage des 50 plus récents ({landingStats.quiz.leads.length} au total sur la période). Exporte en CSV pour voir tous les leads.
                </p>
              )}
            </div>
          )}
        </div>
 
        {/* ─── SCROLL DEPTH ─── */}
        <div style={glassCard}>
          <h3 style={sectionTitle}>Profondeur de lecture</h3>
          <p style={sectionDesc}>Combien de visiteuses scrollent jusqu'au bout de la page.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <ScrollBucket label="25%" value={landingStats.scrollDepth.reachedQuarter} total={landingStats.scrollDepth.totalSessions} color={C.copper} />
            <ScrollBucket label="50%" value={landingStats.scrollDepth.reachedHalf} total={landingStats.scrollDepth.totalSessions} color={C.copperDark} />
            <ScrollBucket label="75%" value={landingStats.scrollDepth.reachedThreeQuarters} total={landingStats.scrollDepth.totalSessions} color={C.green} />
            <ScrollBucket label="100%" value={landingStats.scrollDepth.reachedFull} total={landingStats.scrollDepth.totalSessions} color={C.purple} />
          </div>
        </div>
 
        {/* ─── TRAFFIC SOURCES ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          <div style={{ ...glassCard, marginBottom: 0 }}>
            <h3 style={sectionTitle}>Top sources de trafic</h3>
            <p style={sectionDesc}>D'où viennent tes visiteuses.</p>
            {landingStats.traffic.topReferrers.length === 0 && landingStats.traffic.directVisits === 0 ? (
              <p style={{ fontSize: 13, color: C.brownLight }}>Pas encore de données.</p>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {landingStats.traffic.directVisits > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(212,165,116,0.15)' }}>
                    <span style={{ fontSize: 12, color: C.brown, fontStyle: 'italic' }}>Direct (lien tapé, bio, etc.)</span>
                    <strong style={{ fontSize: 13, color: C.copperDark }}>{landingStats.traffic.directVisits}</strong>
                  </div>
                )}
                {landingStats.traffic.topReferrers.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(212,165,116,0.15)' }}>
                    <span style={{ fontSize: 12, color: C.brown }}>{r.referrer}</span>
                    <strong style={{ fontSize: 13, color: C.copperDark }}>{r.count}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
 
          <div style={{ ...glassCard, marginBottom: 0 }}>
            <h3 style={sectionTitle}>Campagnes UTM</h3>
            <p style={sectionDesc}>Pour tagger tes posts TikTok/Insta : ajoute <code>?utm_source=tiktok&amp;utm_campaign=chronique-1</code></p>
            {landingStats.traffic.utmBreakdown.length === 0 ? (
              <p style={{ fontSize: 13, color: C.brownLight }}>Aucune campagne taguée pour l'instant.</p>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {landingStats.traffic.utmBreakdown.map((u, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(212,165,116,0.15)' }}>
                    <span style={{ fontSize: 12, color: C.brown }}>
                      <strong>{u.source}</strong>
                      {u.medium !== '–' && <span style={{ color: C.brownLight }}> / {u.medium}</span>}
                      {u.campaign !== '–' && <span style={{ color: C.brownLight, fontStyle: 'italic' }}> · {u.campaign}</span>}
                    </span>
                    <strong style={{ fontSize: 13, color: C.copperDark }}>{u.count}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </>
    ) : (
      <div style={glassCard}>
        <p style={{ fontSize: 13, color: C.brownLight, textAlign: 'center', padding: '20px 0' }}>
          Aucune donnée disponible pour le moment.
        </p>
      </div>
    )}
  </div>
)}
 </div> 

        {/* ─── MODAL DÉFI ─── */}
        {showForm && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(26,26,26,0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}>
            <div style={{
              background: '#fff', border: '1px solid rgba(212,165,116,0.3)',
              borderRadius: 20, maxWidth: 520, width: '100%', padding: '28px 28px',
              maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
            }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, color: C.brown, margin: '0 0 22px', fontWeight: 600 }}>
                {editingChallenge ? '✏️ Modifier le défi' : '+ Nouveau défi'}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: '0 0 80px' }}>
                    <FormLabel>Emoji</FormLabel>
                    <input value={formData.emoji} onChange={e => setFormData(p => ({ ...p, emoji: e.target.value }))}
                      style={{ ...formInput, fontSize: 22, textAlign: 'center', padding: 10 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <FormLabel>Titre *</FormLabel>
                    <input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                      placeholder="Ex: 5 jours de routine matin" style={formInput} />
                  </div>
                </div>

                <div>
                  <FormLabel>Description</FormLabel>
                  <textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                    placeholder="Décris le défi en détail…" rows={3}
                    style={{ ...formInput, resize: 'vertical' as const }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <FormLabel>Début *</FormLabel>
                    <input type="datetime-local" value={formData.starts_at}
                      onChange={e => setFormData(p => ({ ...p, starts_at: e.target.value }))}
                      style={formInput} />
                  </div>
                  <div>
                    <FormLabel>Fin *</FormLabel>
                    <input type="datetime-local" value={formData.ends_at}
                      onChange={e => setFormData(p => ({ ...p, ends_at: e.target.value }))}
                      style={formInput} />
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.is_active}
                    onChange={e => setFormData(p => ({ ...p, is_active: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: C.copper }} />
                  <span style={{ fontSize: 13, color: C.brown }}>Défi actif (visible dans la communauté)</span>
                </label>

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button onClick={saveChallenge} disabled={saving || !formData.title} style={{
                    flex: 1, padding: '12px',
                    background: formData.title
                      ? 'linear-gradient(135deg, #c4956a, #8b5a3c)'
                      : 'rgba(196,149,106,0.3)',
                    border: 'none', borderRadius: 12, color: '#fff',
                    fontSize: 14, fontWeight: 700,
                    cursor: formData.title ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit',
                  }}>
                    {saving ? 'Enregistrement…' : editingChallenge ? '✓ Mettre à jour' : '✓ Créer le défi'}
                  </button>
                  <button onClick={() => setShowForm(false)} style={{
                    padding: '12px 20px', background: '#fff',
                    border: '1px solid rgba(212,165,116,0.3)', borderRadius: 12,
                    color: C.brownLight, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                  }}>Annuler</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─ Composants helpers ─
function KpiTile({ emoji, label, value, accent, sub, selected, onClick }: { emoji: string; label: string; value: number; accent: string; sub?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: selected
          ? 'linear-gradient(135deg, rgba(255,255,255,0.85), rgba(255,255,255,0.55))'
          : 'linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0.25))',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: selected ? `1.5px solid ${accent}` : '1px solid rgba(255,255,255,0.5)',
        borderRadius: 16, padding: '16px 14px',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        transition: 'all 0.2s',
        boxShadow: selected ? `0 6px 20px ${accent}44` : '0 4px 16px rgba(139, 90, 60, 0.06)',
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }}>{emoji}</div>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 600, color: accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#3d2618', marginTop: 6, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: '#6b5340', marginTop: 2, fontStyle: 'italic' }}>{sub}</div>}
    </button>
  )
}

interface ReviewKpiProps {
  label: string
  source: string
  value?: number
  unit: string
  targetByMonth: [number, number, number] // M1, M2, M3
  alert: number
  higherIsBetter?: boolean
  currentMonth: 1 | 2 | 3
  sub?: string
  isManual?: boolean
  manualValue?: string
  onManualChange?: (v: string) => void
}

function ReviewKpi({
  label, source, value, unit,
  targetByMonth, alert, higherIsBetter = true,
  currentMonth, sub,
  isManual = false, manualValue, onManualChange,
}: ReviewKpiProps) {
  const target = targetByMonth[currentMonth - 1]

  // Valeur effective utilisée pour le calcul du statut
  const effectiveValue = isManual
    ? (manualValue && manualValue !== '' ? parseFloat(manualValue) : null)
    : (value ?? null)

  const C_ = {
    green: '#7ba869', yellow: '#d4a738', red: '#c44a4a',
    grey: '#9c8a76', brown: '#3d2618', brownLight: '#6b5340',
  }

  let statusColor = C_.grey
  let statusEmoji = '⚪'

  if (effectiveValue !== null) {
    if (higherIsBetter) {
      if (effectiveValue >= target) { statusColor = C_.green; statusEmoji = '🟢' }
      else if (effectiveValue >= alert) { statusColor = C_.yellow; statusEmoji = '🟡' }
      else { statusColor = C_.red; statusEmoji = '🔴' }
    } else {
      if (effectiveValue <= target) { statusColor = C_.green; statusEmoji = '🟢' }
      else if (effectiveValue <= alert) { statusColor = C_.yellow; statusEmoji = '🟡' }
      else { statusColor = C_.red; statusEmoji = '🔴' }
    }
  }

  const formatVal = (n: number) => {
    if (unit === '%') return n.toFixed(1)
    if (unit === '€') return Math.round(n).toString()
    if (unit === '' && n >= 1000) return n.toLocaleString('fr-FR')
    if (n < 1 && n > 0) return n.toFixed(2)
    return Math.round(n).toString()
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(255,255,255,0.65), rgba(255,255,255,0.35))',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      border: '1px solid rgba(255,255,255,0.6)',
      borderRadius: 14, padding: '14px 14px',
      boxShadow: '0 2px 8px rgba(139, 90, 60, 0.05)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: C_.brown, fontWeight: 700, lineHeight: 1.3 }}>{label}</div>
          <div style={{ fontSize: 10, color: C_.brownLight, opacity: 0.8, marginTop: 2 }}>{source}</div>
        </div>
        <div style={{ fontSize: 14, flexShrink: 0 }}>{statusEmoji}</div>
      </div>

      {isManual ? (
        <input
          type="number"
          step="any"
          value={manualValue ?? ''}
          onChange={e => onManualChange?.(e.target.value)}
          placeholder="—"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: '#faf7f2',
            border: `1.5px solid ${effectiveValue !== null ? statusColor + '55' : 'rgba(212,165,116,0.25)'}`,
            borderRadius: 10,
            padding: '6px 10px',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 26, fontWeight: 600,
            color: statusColor,
            outline: 'none',
          }}
        />
      ) : (
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 600, color: statusColor, lineHeight: 1 }}>
          {value !== undefined ? formatVal(value) : '—'}{unit}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 10, color: C_.brownLight, gap: 6 }}>
        <span>Cible M{currentMonth} : <strong style={{ color: C_.brown }}>{higherIsBetter ? '≥' : '≤'} {target}{unit}</strong></span>
        <span>Alerte : <strong style={{ color: C_.red }}>{higherIsBetter ? '<' : '>'} {alert}{unit}</strong></span>
      </div>
      {sub && <div style={{ fontSize: 10, color: C_.brownLight, marginTop: 4, fontStyle: 'italic' }}>{sub}</div>}
    </div>
  )
}

function BrevoCell({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'green' | 'yellow' | 'red'
}) {
  const C_ = {
    brown: '#3d2618', brownLight: '#6b5340',
    green: '#5C8C4A', yellow: '#A88A4A', red: '#A8423A',
    neutral: '#8b5a3c',
  }
  const valueColor = accent === 'green' ? C_.green
    : accent === 'yellow' ? C_.yellow
    : accent === 'red' ? C_.red
    : C_.neutral

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(255,255,255,0.65), rgba(255,255,255,0.35))',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      border: '1px solid rgba(255,255,255,0.6)',
      borderRadius: 14, padding: '14px 14px',
    }}>
      <div style={{ fontSize: 11, color: C_.brownLight, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 30, fontWeight: 600, color: valueColor, lineHeight: 1,
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: C_.brownLight, marginTop: 6, fontStyle: 'italic' }}>{sub}</div>}
    </div>
  )
}

function FormLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      fontSize: 11, color: '#6b5340', display: 'block', marginBottom: 6,
      textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
    }}>{children}</label>
  )
}

function FunnelStep({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(255,255,255,0.65), rgba(255,255,255,0.35))',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      border: '1px solid rgba(255,255,255,0.6)',
      borderRadius: 14, padding: '14px 14px',
    }}>
      <div style={{ fontSize: 11, color: '#6b5340', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 600, color: color, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#6b5340', marginTop: 4, fontStyle: 'italic' }}>
        {pct}% des visiteuses
      </div>
    </div>
  )
}

function ScrollBucket({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(255,255,255,0.65), rgba(255,255,255,0.35))',
      backdropFilter: 'blur(18px)',
      border: '1px solid rgba(255,255,255,0.6)',
      borderRadius: 14, padding: '14px 14px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: '#6b5340', fontWeight: 600, letterSpacing: '1.5px' }}>
        SCROLL {label}
      </div>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 600, color: color, lineHeight: 1, margin: '8px 0 4px' }}>
        {pct}%
      </div>
      <div style={{ fontSize: 11, color: '#6b5340', fontStyle: 'italic' }}>
        {value} / {total} sessions
      </div>
    </div>
  )
}

const formInput: React.CSSProperties = {
  width: '100%', background: '#faf7f2',
  border: '1px solid rgba(212,165,116,0.3)', borderRadius: 10,
  padding: '10px 14px', fontSize: 14, outline: 'none', color: '#3d2618',
  fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box',
}

const glassCard: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.25))',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(255, 255, 255, 0.5)',
  borderRadius: 20, padding: 22, marginBottom: 16,
  boxShadow: '0 4px 16px rgba(139, 90, 60, 0.06)',
}

const sectionTitle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 20, color: '#3d2618',
  margin: '0 0 4px', fontWeight: 500,
}

const sectionDesc: React.CSSProperties = {
  fontSize: 12, color: '#6b5340',
  margin: '0 0 16px', opacity: 0.85,
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '8px 10px',
  fontSize: 10, fontWeight: 700,
  color: '#6b5340', textTransform: 'uppercase', letterSpacing: '0.08em',
}

const td: React.CSSProperties = {
  padding: '10px 10px', fontSize: 12, color: '#3d2618',
}

const smallBtn: React.CSSProperties = {
  padding: '6px 10px', background: 'rgba(255,255,255,0.5)',
  border: '1px solid rgba(212,165,116,0.3)', borderRadius: 8,
  color: '#6b5340', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
}