// src/app/page.tsx
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
import StreakFlame from '@/components/StreakFlame';

// Dans ton JSX, là où tu veux la flamme (typiquement sous le "Bonjour, Ness 👋"):
<StreakFlame />
// ─────────────────────────────────────────────────────────────────────────────
// Modules
// ─────────────────────────────────────────────────────────────────────────────

const modules = [
  { href: '/program',   emoji: '🎯', title: 'Programme 90j' },
  { href: '/planner',   emoji: '📅', title: 'Planner'        },
  { href: '/defis',     emoji: '⚡', title: 'Défis'          },
  { href: '/tracker',   emoji: '📊', title: 'Tracker'        },
  { href: '/routines',  emoji: '☀️', title: 'Routines'       },
  { href: '/agent',     emoji: '🤖', title: 'Agent IA'       },
  { href: '/recipes',   emoji: '🍴', title: 'Recettes'       },
  { href: '/family',    emoji: '💛', title: 'Famille'        },
  { href: '/notes',     emoji: '📝', title: 'Notes'          },
  { href: '/community', emoji: '👥', title: 'Communauté'     },
  { href: '/astuces',   emoji: '💡', title: 'Astuces'        },
]

const MODULES_GRID = [
  { href: '/program',   emoji: '🎯', title: 'Programme 90j', tone: 'ic-programme' },
  { href: '/planner',   emoji: '📅', title: 'Planner',       tone: 'ic-planner'   },
  { href: '/tracker',   emoji: '📊', title: 'Tracker',       tone: 'ic-tracker'   },
  { href: '/routines',  emoji: '☀️', title: 'Routines',      tone: 'ic-routines'  },
  { href: '/agent',     emoji: '🤖', title: 'Agent IA',      tone: 'ic-agent'     },
  { href: '/recipes',   emoji: '🍴', title: 'Recettes',      tone: 'ic-recettes'  },
  { href: '/family',    emoji: '💛', title: 'Famille',       tone: 'ic-famille'   },
  { href: '/notes',     emoji: '📝', title: 'Notes',         tone: 'ic-notes'     },
  { href: '/astuces',   emoji: '💡', title: 'Astuces',       tone: 'ic-astuces'   },
]

const PHASE_MESSAGES: Record<string, { label: string; message: string; phase: string }> = {
  reprogrammation: { phase: 'Phase 1', label: 'Reprogrammation', message: 'Tu construis les fondations. Chaque petit geste compte.' },
  action:          { phase: 'Phase 2', label: 'Action & Discipline', message: "Tu passes à l'action. La régularité est ta force." },
  expansion:       { phase: 'Phase 3', label: 'Expansion', message: "Tu es en phase d'expansion. Continue à viser haut." },
  start:           { phase: 'Programme 90j', label: 'Prête à commencer', message: "Démarre ton programme de 90 jours pour te transformer." },
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function getPhase(day: number) {
  if (day < 1) return 'start'
  if (day <= 30) return 'reprogrammation'
  if (day <= 60) return 'action'
  return 'expansion'
}

export default function HomePage() {
  const { user } = useSupabaseAuth()
  const pseudo = usePseudo()
  const router = useRouter()

  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [currentDay, setCurrentDay] = useState(0)
  const [programProgress, setProgramProgress] = useState(0)
  const [todayTasks, setTodayTasks] = useState<any[]>([])
  const [streak, setStreak] = useState(0)
  const [intention, setIntention] = useState<string | null>(null)
  const [proverbeDuJour, setProverbeDuJour] = useState('')
  const [todayPlannerCount, setTodayPlannerCount] = useState(0)
  const [activeChallengesCount, setActiveChallengesCount] = useState(0)

  // Communauté
const [newCommunityPosts, setNewCommunityPosts] = useState<number | null>(null)

const [struggle, setStruggle] = useState<StruggleState>({ active: false, reason: null })
  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'Bonne nuit' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Bonne après-midi' : 'Bonsoir'

  // ── Onboarding redirect ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || onboardingChecked) return
    ;(async () => {
      const { data } = await supabase
        .from('ai_personality_profile')
        .select('id')
        .eq('user_id', user.id)
        .single()
      setOnboardingChecked(true)
      if (!data) router.push('/onboarding')
    })()
  }, [user, onboardingChecked, router])

  // ── Proverbe + intention locale ────────────────────────────────────────────
  useEffect(() => {
    setProverbeDuJour(getProverbeDuJour())
    const today = fmtDate(new Date())
    const saved = localStorage.getItem(`novae-reflection-${today}`)
    if (saved) {
      try {
        setIntention(JSON.parse(saved).morningIntention || null)
      } catch {}
    }
  }, [])

  // ── Données ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    if (!user) return

    try {
      const [prog, tasks] = await Promise.all([
        supabase.from('program_progress').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('tasks').select('*').eq('user_id', user.id).eq('status', 'pending'),
      ])

      if (prog.error) console.error('[HomePage] program_progress error:', prog.error)
      if (tasks.error) console.error('[HomePage] tasks error:', tasks.error)

      if (prog.data) {
        const d = prog.data.current_day || 1
        setCurrentDay(d)
        setProgramProgress(Math.round((d / 90) * 100))
        setStreak(prog.data.streak || 0)
      } else {
        setCurrentDay(0)
        setProgramProgress(0)
        setStreak(0)
      }
      setTodayTasks(tasks.data || [])
    } catch (err) {
      console.error('[HomePage] loadData error:', err)
    }

    loadCommunityCountFast()
    loadTodayPlanner()
    loadActiveChallenges()
    detectStruggleMode(supabase, user.id).then(setStruggle).catch(() => {})
  }

  const loadCommunityCountFast = async () => {
    if (!user) return
    try {
      const cacheKey = 'novae-community-count'
      const cacheTimeKey = 'novae-community-count-time'
      const cached = sessionStorage.getItem(cacheKey)
      const cachedTime = sessionStorage.getItem(cacheTimeKey)
      const now = Date.now()

      if (cached && cachedTime && (now - parseInt(cachedTime)) < 60000) {
        setNewCommunityPosts(parseInt(cached))
        return
      }

      const lastVisit = localStorage.getItem('novae-community-last-visit')
      const since = lastVisit
        ? new Date(lastVisit).toISOString()
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const { count, error } = await supabase
        .from('community_posts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since)
        .neq('user_id', user.id)

      if (error) {
        console.error('[HomePage] community count error:', error)
        setNewCommunityPosts(0)
        return
      }

      const value = count || 0
      setNewCommunityPosts(value)
      sessionStorage.setItem(cacheKey, String(value))
      sessionStorage.setItem(cacheTimeKey, String(now))
    } catch (err) {
      console.error('[HomePage] community fetch error:', err)
      setNewCommunityPosts(0)
    }
  }

  const loadTodayPlanner = async () => {
    if (!user) return
    try {
      const today = fmtDate(new Date())
      const { count, error } = await supabase
        .from('planner_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('start_date', `${today}T00:00:00`)
        .lt('start_date', `${today}T23:59:59`)
      if (error) console.error('[HomePage] planner count error:', error)
      setTodayPlannerCount(count || 0)
    } catch (err) {
      console.error('[HomePage] planner fetch error:', err)
      setTodayPlannerCount(0)
    }
  }

  const loadActiveChallenges = async () => {
    if (!user) return
    try {
      const { count, error } = await supabase
        .from('challenge_participations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('completed', false)
      if (error) console.error('[HomePage] challenges count error:', error)
      setActiveChallengesCount(count || 0)
    } catch (err) {
      console.error('[HomePage] challenges fetch error:', err)
      setActiveChallengesCount(0)
    }
  }

  const restartTour = () => {
    localStorage.removeItem('novae-onboarding-done')
    setShowTour(true)
    window.dispatchEvent(new CustomEvent('novae-restart-tour'))
  }

  const phaseInfo = PHASE_MESSAGES[getPhase(currentDay)]

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <OnboardingTour forceShow={showTour} onClose={() => setShowTour(false)} />

      {/* Fond luxe rose poudré */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          background:
            'radial-gradient(ellipse at 20% 0%, #e8c4a8 0%, transparent 55%),' +
            'radial-gradient(ellipse at 80% 100%, #d4a574 0%, transparent 55%),' +
            'linear-gradient(180deg, #f3dcc6 0%, #ead0b5 50%, #e0c4a3 100%)',
        }}
      />

      <div
        style={{
          minHeight: '100vh',
          fontFamily: "'DM Sans', sans-serif",
          position: 'relative',
          zIndex: 2,
          paddingBottom: 100,
        }}
      >

        {/* ════════ HEADER BANDEAU PREMIUM (sticky) ════════ */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            background:
              'linear-gradient(180deg, rgba(91, 56, 33, 0.94) 0%, rgba(112, 73, 45, 0.88) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(212, 165, 116, 0.4)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.18)',
            padding: '18px 20px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 28,
                fontWeight: 500,
                color: '#f3dcc6',
                letterSpacing: '1.2px',
                textShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            >
              Novaé
            </span>
            <span
              style={{
                fontSize: 8.5,
                color: '#d4a574',
                letterSpacing: '2.2px',
                textTransform: 'uppercase',
                marginTop: 3,
                fontWeight: 500,
              }}
            >
              by Omanaïa
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Cloche notifs */}
            <NotificationBell />

            {/* Pill Mon Profil */}
            {user && (
              <Link
                href="/profil"
                style={{
                  padding: '7px 12px',
                  borderRadius: 16,
                  background: 'rgba(243, 220, 198, 0.15)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(243, 220, 198, 0.3)',
                  color: '#f3dcc6',
                  textDecoration: 'none',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontSize: 12 }}>✦</span>
                Mon Profil
              </Link>
            )}

            {user ? (
              <UserMenu />
            ) : (
              <Link
                href="/auth"
                style={{
                  padding: '7px 14px',
                  borderRadius: 16,
                  background: 'rgba(243, 220, 198, 0.15)',
                  border: '1px solid rgba(243, 220, 198, 0.25)',
                  color: '#f3dcc6',
                  textDecoration: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Se connecter
              </Link>
            )}
          </div>
        </div>

        {/* ════════ CONTENU SCROLLABLE ════════ */}
        <main style={{ maxWidth: 600, margin: '0 auto', padding: '20px 18px 40px' }}>

          {/* Greeting + proverbe */}
          <div style={{ marginBottom: 20 }}>
            <p
              style={{
                fontSize: 10.5,
                color: '#8b6f55',
                textTransform: 'uppercase',
                letterSpacing: '2.5px',
                margin: '0 0 6px',
                fontWeight: 600,
              }}
            >
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 36,
                fontWeight: 400,
                color: '#3d2618',
                margin: '0 0 4px',
                lineHeight: 1,
                letterSpacing: '0.5px',
              }}
            >
              {greeting}
              {pseudo && (
                <>
                  , <span style={{ color: '#8b5a3c', fontStyle: 'italic' }}>{pseudo}</span>
                </>
              )}{' '}
              👋
            </h1>
            <p
              style={{
                marginTop: 14,
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 15,
                fontStyle: 'italic',
                color: '#6b5340',
                lineHeight: 1.45,
                borderLeft: '2px solid #c4956a',
                paddingLeft: 12,
                margin: '14px 0 0',
              }}
            >
              « {proverbeDuJour} »
            </p>
          </div>

          {/* ════════ MODE TRAVERSÉE DIFFICILE ════════ */}
          {struggle.active && (
            <Link href="/agent" style={{ textDecoration: 'none', display: 'block', marginBottom: 14 }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(196,149,106,0.20), rgba(123,111,160,0.18))',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(196,149,106,0.35)',
                  borderRadius: 16,
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  boxShadow: '0 4px 18px rgba(196,149,106,0.12)',
                }}
              >
                <span style={{ fontSize: 24 }}>🌙</span>
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontSize: 9.5, fontWeight: 700, color: '#8b5a3c', margin: '0 0 3px',
                    textTransform: 'uppercase', letterSpacing: '0.18em',
                  }}>
                    Une période plus calme ?
                  </p>
                  <p style={{
                    fontSize: 14, color: '#3d2618', margin: 0,
                    fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
                  }}>
                    Je suis là si tu veux juste échanger.
                  </p>
                </div>
                <span style={{ color: '#8b5a3c', fontSize: 16 }}>→</span>
              </div>
            </Link>
          )}

          {/* ════════ CARTE PROGRAMME 90J — TOUJOURS AFFICHÉE ════════ */}
          <Link href="/program" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
            <div
              style={{
                padding: '22px 22px 24px',
                background:
                  'linear-gradient(135deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.25))',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                borderRadius: 24,
                boxShadow:
                  '0 8px 24px rgba(139, 90, 60, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -40,
                  right: -40,
                  width: 120,
                  height: 120,
                  background: 'radial-gradient(circle, rgba(212, 165, 116, 0.4), transparent)',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                }}
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 14,
                  position: 'relative',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 9.5,
                      color: '#8b6f55',
                      textTransform: 'uppercase',
                      letterSpacing: '2.5px',
                      fontWeight: 600,
                    }}
                  >
                    {phaseInfo.phase}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: 18,
                      color: '#3d2618',
                      marginTop: 2,
                      fontWeight: 500,
                    }}
                  >
                    {phaseInfo.label}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  {streak > 0 && (
                    <div
                      style={{
                        background: 'rgba(255,165,0,0.14)',
                        border: '1px solid rgba(255,165,0,0.35)',
                        borderRadius: 10,
                        padding: '4px 9px',
                      }}
                    >
                      <span style={{ fontSize: 12 }}>🔥</span>
                      <span style={{ fontSize: 11, color: '#b8732d', fontWeight: 700, marginLeft: 4 }}>
                        {streak}j
                      </span>
                    </div>
                  )}
                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: 26,
                        fontWeight: 500,
                        color: '#8b5a3c',
                        lineHeight: 1,
                      }}
                    >
                      {programProgress}%
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: '#8b6f55',
                        textTransform: 'uppercase',
                        letterSpacing: '1.5px',
                      }}
                    >
                      Accompli
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 14 }}>
                <span
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 60,
                    fontWeight: 500,
                    color: '#3d2618',
                    lineHeight: 1,
                  }}
                >
                  {currentDay > 0 ? currentDay : '—'}
                </span>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#a08770' }}>
                  / 90
                </span>
              </div>

              <div
                style={{
                  height: 4,
                  background: 'rgba(139, 90, 60, 0.15)',
                  borderRadius: 999,
                  overflow: 'hidden',
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${programProgress}%`,
                    background: 'linear-gradient(90deg, #d4a574, #c4956a)',
                    borderRadius: 999,
                    transition: 'width 1s ease',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 13, color: '#6b5340', lineHeight: 1.5, flex: 1 }}>
                  {phaseInfo.message}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: '#8b5a3c',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Voir →
                </span>
              </div>
            </div>
          </Link>

          {/* ════════ 4 RACCOURCIS RAPIDES ════════ */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
              marginBottom: 18,
            }}
          >
            <Link href="/planner" style={{ textDecoration: 'none' }}>
              <div style={quickTileStyle}>
                <div style={{ fontSize: 20, marginBottom: 1 }}>📋</div>
                <div style={quickNumStyle}>{todayTasks.length}</div>
                <div style={quickLabelStyle}>À faire</div>
              </div>
            </Link>

            <Link href="/planner" style={{ textDecoration: 'none' }}>
              <div style={quickTileStyle}>
                <div style={{ fontSize: 20, marginBottom: 1 }}>📅</div>
                <div style={quickNumStyle}>{todayPlannerCount}</div>
                <div style={quickLabelStyle}>Planning</div>
              </div>
            </Link>

            <Link
              href="/community"
              onClick={() => localStorage.setItem('novae-community-last-visit', new Date().toISOString())}
              style={{ textDecoration: 'none' }}
            >
              <div style={{ ...quickTileStyle, position: 'relative' }}>
                {newCommunityPosts !== null && newCommunityPosts > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 5,
                      right: 5,
                      background: 'linear-gradient(135deg, #c44757, #8b2d3d)',
                      color: 'white',
                      fontSize: 9,
                      fontWeight: 700,
                      minWidth: 18,
                      height: 18,
                      padding: '0 5px',
                      borderRadius: 999,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1.5px solid #f3dcc6',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
                    }}
                  >
                    {newCommunityPosts > 9 ? '9+' : newCommunityPosts}
                  </span>
                )}
                <div style={{ fontSize: 20, marginBottom: 1 }}>👥</div>
                <div style={quickNumStyle}>
                  {newCommunityPosts === null ? '…' : newCommunityPosts > 0 ? newCommunityPosts : '—'}
                </div>
                <div style={quickLabelStyle}>Communauté</div>
              </div>
            </Link>

            <Link href="/defis" style={{ textDecoration: 'none' }}>
              <div style={quickTileStyle}>
                <div style={{ fontSize: 20, marginBottom: 1 }}>⚡</div>
                <div style={quickNumStyle}>{activeChallengesCount}</div>
                <div style={quickLabelStyle}>Défis</div>
              </div>
            </Link>
          </div>

          {/* ════════ INTENTION DU JOUR ════════ */}
          {intention ? (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.2))',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                borderRadius: 14,
                padding: '14px 18px',
                marginBottom: 22,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 20 }}>✨</span>
              <div style={{ flex: 1 }}>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#8b5a3c',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    margin: '0 0 3px',
                  }}
                >
                  Mon intention
                </p>
                <p
                  style={{
                    fontSize: 15,
                    color: '#3d2618',
                    fontStyle: 'italic',
                    margin: 0,
                    fontFamily: "'Cormorant Garamond', serif",
                  }}
                >
                  "{intention}"
                </p>
              </div>
              <Link href="/routines" style={{ fontSize: 11, color: '#8b5a3c', textDecoration: 'none', flexShrink: 0, fontWeight: 600 }}>
                Modifier →
              </Link>
            </div>
          ) : (
            <Link href="/routines" style={{ textDecoration: 'none', display: 'block', marginBottom: 22 }}>
              <div
                style={{
                  background: 'rgba(196,149,106,0.18)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px dashed rgba(139, 90, 60, 0.4)',
                  borderRadius: 14,
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 20 }}>✨</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#5c3d28', margin: '0 0 2px' }}>
                    Définir mon intention du jour
                  </p>
                  <p style={{ fontSize: 11, color: '#8b6f55', margin: 0 }}>
                    Commence avec clarté et focus
                  </p>
                </div>
                <span style={{ color: '#8b5a3c', fontSize: 16 }}>→</span>
              </div>
            </Link>
          )}

          {/* ════════ TITRE GRILLE MODULES ════════ */}
          <div
            style={{
              padding: '4px 4px 12px',
              fontSize: 9.5,
              color: '#8b6f55',
              textTransform: 'uppercase',
              letterSpacing: '2.5px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                height: 1,
                flex: 1,
                background: 'linear-gradient(90deg, transparent, rgba(139, 90, 60, 0.3), transparent)',
              }}
            />
            Tous les modules
            <span
              style={{
                height: 1,
                flex: 1,
                background: 'linear-gradient(90deg, transparent, rgba(139, 90, 60, 0.3), transparent)',
              }}
            />
          </div>

          {/* ════════ GRILLE MODULES ════════ */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 9,
              marginBottom: 22,
            }}
          >
            {MODULES_GRID.map((mod) => (
              <Link key={mod.href} href={mod.href} style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.2))',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.5)',
                    borderRadius: 16,
                    padding: '13px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    boxShadow: '0 4px 12px rgba(139, 90, 60, 0.06)',
                  }}
                >
                  <div style={{ ...modIconBaseStyle, ...modIconTones[mod.tone] }}>{mod.emoji}</div>
                  <div style={{ fontSize: 12.5, color: '#3d2618', fontWeight: 600, lineHeight: 1.1 }}>
                    {mod.title}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* ════════ TUTO + PARAMS ════════ */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center', paddingRight: 4 }}>
            <button
              onClick={restartTour}
              style={{
                padding: '7px 14px',
                background: 'rgba(255, 255, 255, 0.5)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(212, 165, 116, 0.35)',
                borderRadius: 999,
                fontSize: 11,
                color: '#5c4530',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              🎓 Tuto
            </button>
            <Link
              href="/settings"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.5)',
                border: '1px solid rgba(212, 165, 116, 0.35)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              ⚙️
            </Link>
          </div>
        </main>

        {/* ════════ BOTTOM NAV ════════ */}
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 40,
            background:
              'linear-gradient(180deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 246, 235, 0.94) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(212, 165, 116, 0.35)',
            padding: '6px 0 12px',
            boxShadow: '0 -4px 24px rgba(139, 90, 60, 0.12)',
          }}
        >
          <div
            className="hide-scrollbar"
            style={{
              display: 'flex',
              overflowX: 'auto',
              overflowY: 'hidden',
              padding: '0 14px',
              gap: 14,
              WebkitOverflowScrolling: 'touch',
              scrollBehavior: 'smooth',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {modules.map((mod) => {
              const isCommunity = mod.href === '/community'
              return (
                <Link
                  key={mod.href}
                  href={mod.href}
                  onClick={
                    isCommunity
                      ? () => localStorage.setItem('novae-community-last-visit', new Date().toISOString())
                      : undefined
                  }
                  style={{
                    flex: '0 0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    padding: '4px 4px',
                    minWidth: 56,
                    textDecoration: 'none',
                    position: 'relative',
                  }}
                >
                  <span style={{ fontSize: 19, lineHeight: 1 }}>{mod.emoji}</span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      color: '#6b5340',
                      letterSpacing: '0.3px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {mod.title.split(' ')[0]}
                  </span>
                  {isCommunity && newCommunityPosts !== null && newCommunityPosts > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        background: 'linear-gradient(135deg, #c44757, #8b2d3d)',
                        color: 'white',
                        fontSize: 8,
                        fontWeight: 700,
                        minWidth: 14,
                        height: 14,
                        padding: '0 3px',
                        borderRadius: 999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {newCommunityPosts > 9 ? '9+' : newCommunityPosts}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>

        <style jsx>{`
          .hide-scrollbar::-webkit-scrollbar { display: none; }
        `}</style>

      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles partagés
// ─────────────────────────────────────────────────────────────────────────────

const quickTileStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.25))',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.5)',
  borderRadius: 16,
  padding: '12px 4px 10px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 3,
  boxShadow: '0 4px 12px rgba(139, 90, 60, 0.06)',
  position: 'relative',
}

const quickNumStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 19,
  fontWeight: 600,
  color: '#3d2618',
  lineHeight: 1,
}

const quickLabelStyle: React.CSSProperties = {
  fontSize: 8.5,
  color: '#6b5340',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  fontWeight: 600,
  textAlign: 'center',
  lineHeight: 1.1,
}

const modIconBaseStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 17,
  flexShrink: 0,
}

const modIconTones: Record<string, React.CSSProperties> = {
  'ic-programme': { background: 'linear-gradient(135deg, #f0d4b8, #e0bd95)' },
  'ic-planner':   { background: 'linear-gradient(135deg, #e8d8c4, #d4bfa3)' },
  'ic-tracker':   { background: 'linear-gradient(135deg, #ecdcc4, #d8c2a0)' },
  'ic-routines':  { background: 'linear-gradient(135deg, #f2d9bd, #dfba8e)' },
  'ic-agent':     { background: 'linear-gradient(135deg, #e6d0b8, #c9a888)' },
  'ic-recettes':  { background: 'linear-gradient(135deg, #f0d8be, #dcb78a)' },
  'ic-famille':   { background: 'linear-gradient(135deg, #f5d8c8, #e0b29a)' },
  'ic-notes':     { background: 'linear-gradient(135deg, #ead7c0, #d3b893)' },
  'ic-astuces':   { background: 'linear-gradient(135deg, #f3dec5, #dfbe92)' },
}