// src/app/HomePageClient.tsx — v6
// Objectif du jour affiché sur la carte après saisie
'use client'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { usePseudo } from '@/hooks/usePseudo'
import { UserMenu } from '@/components/UserMenu'
import { OnboardingTour } from '@/components/OnboardingTour'
import { getProverbeDuJour } from '@/lib/proverbes'
import NotificationBell from '@/components/NotificationBell'
import { detectStruggleMode, type StruggleState } from '@/lib/struggle/detect'
import { logEvent } from '@/lib/events'

const ADMIN_EMAILS = ['nesserinesediri@gmail.com', 'omanaiarituals@gmail.com']
const TESTER_EMAILS = ['nesserinesediri@gmail.com']

type ModuleItem = { href: string; title: string; badge?: string; tester?: boolean }
type Univers = {
  key: string; title: string; subtitle: string; icon: string
  tint: string; border: string; ink: string; modules: ModuleItem[]
}

const UNIVERS_LIST: Univers[] = [
  {
    key: 'quotidien', title: 'Mon quotidien', subtitle: 'Organise tes journées avec sérénité.',
    icon: '/icon-quotidien.png', tint: 'rgba(197,211,180,0.25)', border: 'rgba(167,189,144,0.40)', ink: '#5C7044',
    modules: [
      { href: '/planner', title: 'Planner' }, { href: '/routines', title: 'Routines' },
      { href: '/recipes', title: 'Repas' }, { href: '/notes', title: 'Notes' },
    ],
  },
  {
    key: 'transformation', title: 'Ma transformation', subtitle: "Change ta vie un pas après l'autre.",
    icon: '/icon-transformation.png', tint: 'rgba(242,194,182,0.25)', border: 'rgba(223,160,143,0.40)', ink: '#B5654A',
    modules: [
      { href: '/program', title: 'Reset 90j' },
      { href: '/parcours-profonds/reclaim-myself', title: 'Reclaim', badge: 'TEST', tester: true },
      { href: '/defis', title: 'Défis' },
    ],
  },
  {
    key: 'equilibre', title: 'Mon équilibre', subtitle: 'Observe, ajuste et prends soin de toi.',
    icon: '/icon-equilibre.png', tint: 'rgba(212,196,226,0.25)', border: 'rgba(185,162,212,0.40)', ink: '#7E63A8',
    modules: [
      { href: '/tracker', title: 'Tracker' }, { href: '/family', title: 'Famille' },
      { href: '/community', title: 'Commu.' },
    ],
  },
  {
    key: 'accompagnement', title: 'Mon accompagnement', subtitle: "Tu n'avances jamais seule.",
    icon: '/icon-accompagnement.png', tint: 'rgba(245,216,155,0.25)', border: 'rgba(231,192,111,0.40)', ink: '#A8852E',
    modules: [
      { href: '/agent', title: 'Nova', badge: 'IA' },
      { href: '/astuces', title: 'Astuces' },
      { href: '/blog', title: 'Blog' },
    ],
  },
]

const PHASE_MESSAGES: Record<string, { label: string; phase: string }> = {
  reprogrammation: { phase: 'Phase 1', label: 'Reprogrammation' },
  action: { phase: 'Phase 2', label: 'Action' },
  expansion: { phase: 'Phase 3', label: 'Expansion' },
  start: { phase: 'Reset 90j', label: 'Prête à commencer' },
}

function getPhase(day: number) {
  if (day < 1) return 'start'
  if (day <= 30) return 'reprogrammation'
  if (day <= 60) return 'action'
  return 'expansion'
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function HomePageClient() {
  const { user, loading } = useSupabaseAuth()
  const pseudo = usePseudo()
  const router = useRouter()

  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [currentDay, setCurrentDay] = useState(0)
  const [programProgress, setProgramProgress] = useState(0)
  const [proverbeDuJour, setProverbeDuJour] = useState('')
  const [novaPending, setNovaPending] = useState<{ thread_id: string } | null>(null)
  const [struggle, setStruggle] = useState<StruggleState>({ active: false, reason: null })
  const [greeting, setGreeting] = useState('Bonjour')
  const [dateLabel, setDateLabel] = useState('')
  const [newCommunityPosts, setNewCommunityPosts] = useState<number | null>(null)

  // Objectif du jour
  const [showObjectifForm, setShowObjectifForm] = useState(false)
  const [intention, setIntention] = useState('')
  const [priorite, setPriorite] = useState('')
  const [objectifSaved, setObjectifSaved] = useState(false)
  const [objectifLoading, setObjectifLoading] = useState(false)
  const [objectifDuJour, setObjectifDuJour] = useState<{ intention: string; priorite: string } | null>(null)

  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())
  const isTester = !!user?.email && TESTER_EMAILS.includes(user.email.toLowerCase())

  useEffect(() => {
    if (loading) return
    if (!user) return
    if (onboardingChecked) return
    ;(async () => {
      const { data } = await supabase.from('ai_personality_profile').select('id').eq('user_id', user.id).single()
      setOnboardingChecked(true)
      if (!data) router.push('/onboarding')
    })()
  }, [user, loading, onboardingChecked, router])

  useEffect(() => {
    setProverbeDuJour(getProverbeDuJour())
    const h = new Date().getHours()
    setGreeting(h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bonne après-midi' : 'Bonsoir')
    setDateLabel(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))
  }, [])

  useEffect(() => {
    if (loading || !user) return
    loadAllDashboardData()
    logEvent(supabase, user.id, 'module_programme')
  }, [user, loading])

  // PERF (P1) : les 6 requêtes du dashboard sont parallélisées en un seul
  // Promise.all au lieu de 4 fonctions séquentielles (loadData, checkNovaPending,
  // loadCommunity, detectStruggleMode). Un seul aller-retour réseau au lieu de 4.
  const loadAllDashboardData = async () => {
    if (!user) return
    try {
      const lastVisit = localStorage.getItem('novae-community-last-visit')
      const since = lastVisit
        ? new Date(lastVisit).toISOString()
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const [progRes, noteRes, novaRes, communityRes, struggleRes] = await Promise.all([
        supabase.from('program_progress').select('current_day').eq('user_id', user.id).maybeSingle(),
        supabase.from('notes').select('content')
          .eq('user_id', user.id)
          .like('title', 'Objectif du%')
          .gte('created_at', `${fmtDate(new Date())}T00:00:00`)
          .maybeSingle(),
        supabase.from('nova_pending_messages').select('thread_id')
          .eq('user_id', user.id).eq('is_read', false).limit(1),
        supabase.from('community_posts')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', since).neq('user_id', user.id),
        detectStruggleMode(supabase, user.id).catch(() => null),
      ])

      if (progRes.data) {
        const d = progRes.data.current_day || 1
        setCurrentDay(d)
        setProgramProgress(Math.round((d / 90) * 100))
      }

      if (noteRes.data?.content) {
        const lines = noteRes.data.content.split('\n')
        const int = lines.find((l: string) => l.startsWith('Intention :'))?.replace('Intention : ', '') || ''
        const pri = lines.find((l: string) => l.startsWith('Priorité n°1 :'))?.replace('Priorité n°1 : ', '') || ''
        if (int || pri) setObjectifDuJour({ intention: int, priorite: pri })
      }

      if (novaRes.data && novaRes.data.length > 0) {
        setNovaPending({ thread_id: novaRes.data[0].thread_id })
      }

      setNewCommunityPosts(communityRes.count || 0)

      if (struggleRes) setStruggle(struggleRes)
    } catch {
      setNewCommunityPosts(0)
    }
  }

  const handleObjectifSubmit = async () => {
    if (!user || (!intention.trim() && !priorite.trim())) return
    setObjectifLoading(true)
    try {
      const content = `🎯 Objectif du jour\n\nIntention : ${intention}\nPriorité n°1 : ${priorite}`
      await supabase.from('notes').insert({
        user_id: user.id,
        content,
        title: `Objectif du ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      if (priorite.trim()) {
        await supabase.from('todo_list').insert({
          user_id: user.id,
          title: priorite,
          priority: 'high',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
      // Affiche immédiatement sur la carte
      setObjectifDuJour({ intention: intention.trim(), priorite: priorite.trim() })
      setObjectifSaved(true)
      setTimeout(() => {
        setShowObjectifForm(false)
        setObjectifSaved(false)
        setIntention('')
        setPriorite('')
      }, 1800)
    } catch {}
    setObjectifLoading(false)
  }

  const visibleModules = (u: Univers) => {
    if (loading) return u.modules.filter(m => !m.tester)
    return u.modules.filter(m => !m.tester || isTester)
  }

  const phaseInfo = PHASE_MESSAGES[getPhase(currentDay)]

  const UniversCard = ({ u }: { u: Univers }) => {
    const mods = visibleModules(u)
    return (
      <div style={{ background: u.tint, border: `1px solid ${u.border}`, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'row', height: '100%' }}>
        <div style={{ width: 76, flexShrink: 0, background: u.tint.replace('0.25', '0.45'), display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 6px', borderRight: `1px solid ${u.border}` }}>
          <img src={u.icon} alt={u.title} style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 12, mixBlendMode: 'multiply' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: '10px 10px 10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, fontWeight: 600, color: u.ink, lineHeight: 1.1, marginBottom: 2 }}>{u.title}</div>
            <div style={{ fontSize: 9.5, color: '#6b5340', lineHeight: 1.25, marginBottom: 8 }}>{u.subtitle}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${mods.length}, 1fr)`, gap: 5 }}>
            {mods.map((m) => (
              <Link key={m.href} href={m.href} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(255,255,255,0.9)', borderRadius: 9, padding: '7px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: 34 }}>
                  {m.badge && <span style={{ position: 'absolute', top: 2, right: 2, fontSize: 5.5, fontWeight: 700, color: u.ink, background: 'rgba(255,255,255,0.95)', borderRadius: 999, padding: '1px 3px' }}>{m.badge}</span>}
                  <span style={{ fontSize: 10.5, color: '#3d2618', fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>{m.title}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <OnboardingTour forceShow={showTour} onClose={() => setShowTour(false)} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: 'radial-gradient(ellipse at 20% 0%, #F8E6DB 0%, transparent 55%),radial-gradient(ellipse at 80% 100%, #EBD7E0 0%, transparent 60%),linear-gradient(180deg, #FBF4EC 0%, #F8F1E5 55%, #F3E9DF 100%)' }} />

      {/* MODAL OBJECTIF DU JOUR */}
      {showObjectifForm && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(61,38,24,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 20px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowObjectifForm(false) }}
        >
          <div style={{ background: '#FAF7F2', borderRadius: '20px 20px 16px 16px', padding: '24px 20px 20px', width: '100%', maxWidth: 480, boxShadow: '0 -8px 32px rgba(61,38,24,0.18)', fontFamily: "'DM Sans', sans-serif" }}>
            {objectifSaved ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>✨</div>
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: '#3d2618', margin: 0 }}>Objectif enregistré !</p>
                <p style={{ fontSize: 13, color: '#8b6f55', marginTop: 6 }}>Il s'affiche maintenant sur ton accueil.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                  <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#3d2618', margin: 0, fontWeight: 500 }}>
                    {objectifDuJour ? 'Modifier mon objectif' : 'Mon objectif du jour'}
                  </h3>
                  <button onClick={() => setShowObjectifForm(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: '#8b6f55', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#8b6f55', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: 6 }}>
                    Mon intention du jour
                  </label>
                  <input
                    type="text"
                    value={intention}
                    onChange={e => setIntention(e.target.value)}
                    placeholder={objectifDuJour?.intention || "Ex : rester calme et centrée malgré l'agenda chargé"}
                    style={{ width: '100%', border: '1.5px solid #E8E4DF', borderRadius: 10, padding: '11px 13px', fontSize: 14, color: '#1A1A1A', background: '#FFFFFF', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box', outline: 'none' }}
                    onFocus={e => e.target.style.borderColor = '#c4956a'}
                    onBlur={e => e.target.style.borderColor = '#E8E4DF'}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#8b6f55', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: 6 }}>
                    Ma priorité n°1
                  </label>
                  <input
                    type="text"
                    value={priorite}
                    onChange={e => setPriorite(e.target.value)}
                    placeholder={objectifDuJour?.priorite || "Ex : finir le rapport avant 14h"}
                    style={{ width: '100%', border: '1.5px solid #E8E4DF', borderRadius: 10, padding: '11px 13px', fontSize: 14, color: '#1A1A1A', background: '#FFFFFF', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box', outline: 'none' }}
                    onFocus={e => e.target.style.borderColor = '#c4956a'}
                    onBlur={e => e.target.style.borderColor = '#E8E4DF'}
                    onKeyDown={e => { if (e.key === 'Enter') handleObjectifSubmit() }}
                  />
                  <p style={{ fontSize: 11, color: '#a08770', margin: '6px 0 0', fontStyle: 'italic' }}>
                    La priorité sera ajoutée à ta to-do du jour.
                  </p>
                </div>

                <button
                  onClick={handleObjectifSubmit}
                  disabled={objectifLoading || (!intention.trim() && !priorite.trim())}
                  style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: (!intention.trim() && !priorite.trim()) ? '#E8E4DF' : 'linear-gradient(135deg, #c4956a, #b07d5a)', color: (!intention.trim() && !priorite.trim()) ? '#aaa' : '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, cursor: (!intention.trim() && !priorite.trim()) ? 'not-allowed' : 'pointer' }}>
                  {objectifLoading ? 'Enregistrement...' : 'Valider mon objectif →'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif", position: 'relative', zIndex: 2 }}>

        {/* HEADER */}
        <div style={{ flexShrink: 0, background: 'linear-gradient(180deg, rgba(240,201,208,0.97) 0%, rgba(233,186,196,0.92) 100%)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(225,170,180,0.45)', boxShadow: '0 4px 18px rgba(160,110,120,0.12)', padding: '10px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <img src="/logo.png" alt="NOVAÉ by OMANAÏA" style={{ height: 42, objectFit: 'contain', maxWidth: 140 }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Link href="/agent?voice=1" aria-label="Parler à Nova" style={{ textDecoration: 'none' }}>
              <div className="mic-cta" style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: 'linear-gradient(135deg, #c4956a, #b07d5a 55%, #c98b86)', cursor: 'pointer' }}>🎙️</div>
            </Link>
            <NotificationBell />
            {!loading && (user ? <UserMenu /> : (
              <Link href="/auth" style={{ padding: '6px 12px', borderRadius: 16, background: 'rgba(255,255,255,0.45)', border: '1px solid rgba(123,57,71,0.22)', color: '#7A3F4A', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>Se connecter</Link>
            ))}
          </div>
        </div>

        {/* CONTENU */}
        <div style={{ flex: 1, overflowX: 'hidden', padding: '12px 14px 80px' }}>
          <div className="home-content">

            {/* BONJOUR */}
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 9.5, color: '#8b6f55', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 3px', fontWeight: 600 }} suppressHydrationWarning>{dateLabel}</p>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: '#3d2618', margin: 0, lineHeight: 1.1 }} suppressHydrationWarning>
                {greeting}{pseudo && (<>, <span style={{ color: '#8b5a3c', fontStyle: 'italic' }}>{pseudo}</span></>)}{' '}👋
              </h1>
              <p style={{ margin: '6px 0 0', fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontStyle: 'italic', color: '#6b5340', lineHeight: 1.4, borderLeft: '2px solid #c4956a', paddingLeft: 9 }}>« {proverbeDuJour} »</p>
            </div>

            {/* NOVA, ENTRÉE PRINCIPALE (toujours visible, s'adapte au message en attente) */}
            <Link
              href={novaPending ? `/agent?nova_thread=${novaPending.thread_id}` : '/agent'}
              style={{ textDecoration: 'none', display: 'block', marginBottom: 14 }}
            >
              <div style={{ background: 'linear-gradient(135deg, rgba(212,196,226,0.65), rgba(138,111,176,0.28))', border: '1px solid rgba(138,111,176,0.40)', borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'relative', overflow: 'hidden', boxShadow: '0 6px 20px rgba(138,111,176,0.18)' }}>
                <div style={{ position: 'absolute', top: -24, right: -24, width: 90, height: 90, borderRadius: '50%', background: 'rgba(138,111,176,0.16)', pointerEvents: 'none' }} />
                {/* Orbe Nova */}
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #D4C4E2, #8A6FB0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 700, fontSize: 24, flexShrink: 0, boxShadow: '0 4px 12px rgba(138,111,176,0.35)' }}>N</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: '#5b4b7a', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.18em' }}>
                    {novaPending ? "Nova t'a laissé un message" : 'Ton assistante IA'}
                  </p>
                  <p style={{ fontSize: 17, color: '#3d2618', margin: 0, fontFamily: "'Cormorant Garamond', serif", fontWeight: 500, lineHeight: 1.2 }}>
                    {novaPending ? 'Appuie pour lire 💜' : 'Parle à Nova'}
                  </p>
                  <p style={{ fontSize: 11.5, color: '#6b5340', margin: '3px 0 0', lineHeight: 1.35 }}>
                    {novaPending ? 'Elle a pensé à toi.' : 'Elle organise, planifie et agit sur ta journée. Dis-lui ce que tu as en tête.'}
                  </p>
                </div>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #8A6FB0, #6f57a0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 15, flexShrink: 0 }}>→</div>
              </div>
            </Link>

            {/* STRUGGLE */}
            {struggle.active && (
              <Link href="/agent" style={{ textDecoration: 'none', display: 'block', marginBottom: 10 }}>
                <div style={{ background: 'linear-gradient(135deg, rgba(196,149,106,0.20), rgba(123,111,160,0.18))', border: '1px solid rgba(196,149,106,0.35)', borderRadius: 14, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>🌙</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 8.5, fontWeight: 700, color: '#8b5a3c', margin: '0 0 1px', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Une période plus calme ?</p>
                    <p style={{ fontSize: 12, color: '#3d2618', margin: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>Je suis là si tu veux juste échanger.</p>
                  </div>
                  <span style={{ color: '#8b5a3c', flexShrink: 0 }}>→</span>
                </div>
              </Link>
            )}

            {/* DEUX CARTES : OBJECTIF DU JOUR + COMMUNAUTÉ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>

              {/* CARTE OBJECTIF DU JOUR */}
              <div
                onClick={() => {
                  if (objectifDuJour) {
                    setIntention(objectifDuJour.intention)
                    setPriorite(objectifDuJour.priorite)
                  }
                  setShowObjectifForm(true)
                }}
                style={{ background: 'rgba(243,205,182,0.35)', border: '1px solid rgba(230,180,147,0.45)', borderRadius: 14, padding: '12px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 90, position: 'relative', overflow: 'hidden' }}
              >
                <div style={{ position: 'absolute', top: -16, right: -16, width: 60, height: 60, borderRadius: '50%', background: 'rgba(196,149,106,0.15)', pointerEvents: 'none' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 8.5, color: '#8b6f55', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700, marginBottom: 5 }}>Objectif du jour</div>
                  {objectifDuJour ? (
                    <div>
                      {objectifDuJour.intention && (
                        <div style={{ fontSize: 11, color: '#3d2618', lineHeight: 1.4, marginBottom: 4, display: 'flex', gap: 4 }}>
                          <span style={{ color: '#c4956a', fontWeight: 700, flexShrink: 0 }}>✦</span>
                          <span style={{ fontStyle: 'italic' }}>{objectifDuJour.intention}</span>
                        </div>
                      )}
                      {objectifDuJour.priorite && (
                        <div style={{ fontSize: 11, color: '#3d2618', lineHeight: 1.4, display: 'flex', gap: 4 }}>
                          <span style={{ color: '#B5654A', fontWeight: 700, flexShrink: 0 }}>①</span>
                          <span style={{ fontWeight: 600 }}>{objectifDuJour.priorite}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, color: '#6b5340', lineHeight: 1.3 }}>
                      Définis ton intention et ta priorité
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <span style={{ fontSize: 10, color: '#c4956a', fontWeight: 600 }}>
                    {objectifDuJour ? 'Modifier →' : 'Avec Nova →'}
                  </span>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #c4956a, #b07d5a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: objectifDuJour ? 13 : 17, flexShrink: 0 }}>
                    {objectifDuJour ? '✎' : '+'}
                  </div>
                </div>
              </div>

              {/* CARTE COMMUNAUTÉ */}
              <Link href="/community" onClick={() => localStorage.setItem('novae-community-last-visit', new Date().toISOString())} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'rgba(212,196,226,0.30)', border: '1px solid rgba(185,162,212,0.45)', borderRadius: 14, padding: '12px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 90, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: -16, right: -16, width: 60, height: 60, borderRadius: '50%', background: 'rgba(185,162,212,0.18)', pointerEvents: 'none' }} />
                  {newCommunityPosts !== null && newCommunityPosts > 0 && (
                    <span style={{ position: 'absolute', top: 8, right: 8, background: 'linear-gradient(135deg, #c44757, #8b2d3d)', color: '#fff', fontSize: 9, fontWeight: 700, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {newCommunityPosts > 9 ? '9+' : newCommunityPosts}
                    </span>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 8.5, color: '#7E63A8', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700, marginBottom: 5 }}>Communauté</div>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, color: '#6b5340', lineHeight: 1.3 }}>Tu ne reconstruis pas seule</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <span style={{ fontSize: 10, color: '#7E63A8', fontWeight: 600 }}>
                      {newCommunityPosts === null ? '...' : newCommunityPosts > 0 ? `${newCommunityPosts} nouveau${newCommunityPosts > 1 ? 'x' : ''}` : 'À jour ✓'}
                    </span>
                    <span style={{ fontSize: 16 }}>👥</span>
                  </div>
                </div>
              </Link>
            </div>

            {/* LABEL UNIVERS */}
            <div style={{ fontSize: 9, color: '#8b6f55', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, marginBottom: 8, paddingLeft: 2 }}>Mes univers</div>

            {/* 4 UNIVERS */}
            <div className="univers-grid">
              {UNIVERS_LIST.map((u) => <UniversCard key={u.key} u={u} />)}
            </div>

            {/* ADMIN */}
            {isAdmin && (
              <Link href="/admin" style={{ textDecoration: 'none', display: 'block', marginTop: 8 }}>
                <div style={{ background: 'linear-gradient(135deg, rgba(61,38,24,0.85), rgba(107,83,64,0.75))', border: '1px solid rgba(196,149,106,0.4)', borderRadius: 12, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🛡️</span>
                  <div style={{ flex: 1, fontSize: 12, color: '#F3DCC6', fontWeight: 600 }}>Admin · Pilotage</div>
                  <span style={{ color: '#F3DCC6' }}>→</span>
                </div>
              </Link>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 7, alignItems: 'center', marginTop: 10 }}>
              <button onClick={() => { localStorage.removeItem('novae-onboarding-done'); setShowTour(true); window.dispatchEvent(new CustomEvent('novae-restart-tour')) }} style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 999, fontSize: 10, color: '#5c4530', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>🎓 Tuto</button>
              <Link href="/settings" style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(212,165,116,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, textDecoration: 'none' }}>⚙️</Link>
            </div>

          </div>
        </div>
      </div>

      <style jsx>{`
        .home-content { width: 100%; }
        .univers-grid { display: flex; flex-direction: column; gap: 8px; }
        @media (min-width: 768px) {
          .home-content { max-width: 900px; margin: 0 auto; }
          .univers-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        }
        @keyframes micPulse {
          0%, 100% { box-shadow: 0 4px 14px rgba(176,125,90,0.45), 0 0 0 0 rgba(196,149,106,0.55); }
          50% { box-shadow: 0 4px 14px rgba(176,125,90,0.45), 0 0 0 7px rgba(196,149,106,0); }
        }
        .mic-cta { animation: micPulse 2.2s ease-in-out infinite; }
      `}</style>
    </>
  )
}