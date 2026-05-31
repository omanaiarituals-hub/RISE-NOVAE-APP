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
import AdminTile from '@/components/AdminTile'

const MODULES_GRID = [
  { href: '/program',   emoji: '🎯', title: 'Programme 90j', tone: 'ic-programme' },
  { href: '/planner',   emoji: '📅', title: 'Planner',       tone: 'ic-planner'   },
  { href: '/tracker',   emoji: '📊', title: 'Tracker',       tone: 'ic-tracker'   },
  { href: '/routines',  emoji: '☀️', title: 'Routines',      tone: 'ic-routines'  },
  { href: '/agent',     emoji: '🤖', title: 'Agent IA',      tone: 'ic-agent'     },
  { href: '/recipes',   emoji: '🍴', title: 'Repas',         tone: 'ic-recettes'  },
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
  const [proverbeDuJour, setProverbeDuJour] = useState('')
  const [todayPlannerCount, setTodayPlannerCount] = useState(0)
  const [activeChallengesCount, setActiveChallengesCount] = useState(0)
  const [newCommunityPosts, setNewCommunityPosts] = useState<number | null>(null)

  const [struggle, setStruggle] = useState<StruggleState>({ active: false, reason: null })
  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'Bonne nuit' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Bonne après-midi' : 'Bonsoir'

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

  useEffect(() => {
    setProverbeDuJour(getProverbeDuJour())
  }, [])

  useEffect(() => {
    if (user) loadData()
  }, [user])

  const loadData = async () => {
    if (!user) return
    try {
      const [prog, todosRes] = await Promise.all([
        supabase.from('program_progress').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('todo_list').select('id, status').eq('user_id', user.id),
      ])

      if (prog.error) console.error('[HomePage] program_progress error:', prog.error)
      if (todosRes.error) console.error('[HomePage] todo_list error:', todosRes.error)

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

      const pendingTodos = (todosRes.data || []).filter((t: any) => t.status !== 'completed' && t.status !== 'done')
      setTodayTasks(pendingTodos)
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
      const since = lastVisit ? new Date(lastVisit).toISOString() : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { count, error } = await supabase
        .from('community_posts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since)
        .neq('user_id', user.id)
      if (error) { console.error('[HomePage] community count error:', error); setNewCommunityPosts(0); return }
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

  return (
    <>
      <OnboardingTour forceShow={showTour} onClose={() => setShowTour(false)} />

      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 0,
          background:
            'radial-gradient(ellipse at 20% 0%, #F8E6DB 0%, transparent 55%),' +
            'radial-gradient(ellipse at 80% 100%, #EBD7E0 0%, transparent 60%),' +
            'linear-gradient(180deg, #FBF4EC 0%, #F8F1E5 55%, #F3E9DF 100%)',
        }}
      />

      <div style={{ minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", position: 'relative', zIndex: 2, paddingBottom: 24 }}>

        {/* ════════ HEADER BANDEAU (sticky) ════════ */}
        <div style={{ position: 'sticky', top: 0, zIndex: 30, background: 'linear-gradient(180deg, rgba(240,201,208,0.95) 0%, rgba(233,186,196,0.9) 100%)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(225,170,180,0.45)', boxShadow: '0 4px 18px rgba(160,110,120,0.12)', padding: '12px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 500, color: '#5B3821', letterSpacing: '1.2px' }}>Novaé</span>
            <span style={{ fontSize: 8.5, color: '#A86B78', letterSpacing: '2.2px', textTransform: 'uppercase', marginTop: 3, fontWeight: 600 }}>by Omanaïa</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <NotificationBell />
            {user ? <UserMenu /> : (
              <Link href="/auth" style={{ padding: '7px 14px', borderRadius: 16, background: 'rgba(255,255,255,0.45)', border: '1px solid rgba(123,57,71,0.22)', color: '#7A3F4A', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>Se connecter</Link>
            )}
          </div>
        </div>

        {/* ════════ CONTENU ════════ */}
        <main className="home-main">

          {/* Bonjour — pleine largeur */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 10, color: '#8b6f55', textTransform: 'uppercase', letterSpacing: '2.5px', margin: '0 0 5px', fontWeight: 600 }}>
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 400, color: '#3d2618', margin: 0, lineHeight: 1, letterSpacing: '0.5px' }}>
                  {greeting}{pseudo && (<>, <span style={{ color: '#8b5a3c', fontStyle: 'italic' }}>{pseudo}</span></>)}{' '}👋
                </h1>
                <p style={{ marginTop: 9, fontFamily: "'Cormorant Garamond', serif", fontSize: 13.5, fontStyle: 'italic', color: '#6b5340', lineHeight: 1.4, borderLeft: '2px solid #c4956a', paddingLeft: 11 }}>
                  « {proverbeDuJour} »
                </p>
              </div>
              <Link href="/agent?voice=1" aria-label="Parler a Nova" title="Parler a Nova" style={{ textDecoration: 'none', flexShrink: 0, marginTop: 4 }}>
                <div className="mic-cta" style={micButtonStyle}>🎙️</div>
              </Link>
              <Link href="/agent" style={{ textDecoration: 'none', flexShrink: 0, marginTop: 4 }}>
                <div style={novaButtonStyle}><span style={{ fontSize: 13, lineHeight: 1 }}>✦</span><span>Nova</span></div>
              </Link>
            </div>
          </div>

          <div className="home-grid">

            {/* ───────── COLONNE GAUCHE ───────── */}
            <div>

              <div style={{ marginBottom: 12 }}>
                <StreakFlame />
              </div>

              {struggle.active && (
                <Link href="/agent" style={{ textDecoration: 'none', display: 'block', marginBottom: 12 }}>
                  <div style={{ background: 'linear-gradient(135deg, rgba(196,149,106,0.20), rgba(123,111,160,0.18))', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(196,149,106,0.35)', borderRadius: 16, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 22 }}>🌙</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: '#8b5a3c', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.18em' }}>Une période plus calme ?</p>
                      <p style={{ fontSize: 13.5, color: '#3d2618', margin: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>Je suis là si tu veux juste échanger.</p>
                    </div>
                    <span style={{ color: '#8b5a3c', fontSize: 16 }}>→</span>
                  </div>
                </Link>
              )}

              {/* Carte Programme 90j (compacte) */}
              <Link href="/program" style={{ textDecoration: 'none', display: 'block', marginBottom: 12 }}>
                <div style={{ padding: '16px 18px', background: 'linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0.25))', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 18, boxShadow: '0 8px 24px rgba(139,90,60,0.1)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: -40, right: -40, width: 110, height: 110, background: 'radial-gradient(circle, rgba(212,165,116,0.4), transparent)', borderRadius: '50%', pointerEvents: 'none' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, position: 'relative' }}>
                    <div>
                      <div style={{ fontSize: 9, color: '#8b6f55', textTransform: 'uppercase', letterSpacing: '2.2px', fontWeight: 600 }}>{phaseInfo.phase}</div>
                      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, color: '#3d2618', marginTop: 2, fontWeight: 500 }}>{phaseInfo.label}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                      {streak > 0 && (
                        <div style={{ background: 'rgba(255,165,0,0.14)', border: '1px solid rgba(255,165,0,0.35)', borderRadius: 10, padding: '3px 8px' }}>
                          <span style={{ fontSize: 11 }}>🔥</span><span style={{ fontSize: 11, color: '#b8732d', fontWeight: 700, marginLeft: 4 }}>{streak}j</span>
                        </div>
                      )}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 23, fontWeight: 500, color: '#8b5a3c', lineHeight: 1 }}>{programProgress}%</div>
                        <div style={{ fontSize: 8.5, color: '#8b6f55', textTransform: 'uppercase', letterSpacing: '1.4px' }}>Accompli</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 9 }}>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 42, fontWeight: 500, color: '#3d2618', lineHeight: 1 }}>{currentDay > 0 ? currentDay : '—'}</span>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: '#a08770' }}>/ 90</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(139,90,60,0.15)', borderRadius: 999, overflow: 'hidden', marginBottom: 9 }}>
                    <div style={{ height: '100%', width: `${programProgress}%`, background: 'linear-gradient(90deg, #d4a574, #c4956a)', borderRadius: 999, transition: 'width 1s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 12, color: '#6b5340', lineHeight: 1.45, flex: 1 }}>{phaseInfo.message}</div>
                    <span style={{ fontSize: 11, color: '#8b5a3c', fontWeight: 700, whiteSpace: 'nowrap' }}>Voir →</span>
                  </div>
                </div>
              </Link>

              {/* 4 raccourcis rapides */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                <Link href="/planner" style={{ textDecoration: 'none' }}>
                  <div style={quickTileStyle}><div style={{ fontSize: 18, marginBottom: 1 }}>📋</div><div style={quickNumStyle}>{todayTasks.length}</div><div style={quickLabelStyle}>ToDo</div></div>
                </Link>
                <Link href="/planner" style={{ textDecoration: 'none' }}>
                  <div style={quickTileStyle}><div style={{ fontSize: 18, marginBottom: 1 }}>📅</div><div style={quickNumStyle}>{todayPlannerCount}</div><div style={quickLabelStyle}>Planning</div></div>
                </Link>
                <Link href="/community" onClick={() => localStorage.setItem('novae-community-last-visit', new Date().toISOString())} style={{ textDecoration: 'none' }}>
                  <div style={{ ...quickTileStyle, position: 'relative' }}>
                    {newCommunityPosts !== null && newCommunityPosts > 0 && (
                      <span style={{ position: 'absolute', top: 5, right: 5, background: 'linear-gradient(135deg, #c44757, #8b2d3d)', color: 'white', fontSize: 9, fontWeight: 700, minWidth: 17, height: 17, padding: '0 5px', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #f3dcc6' }}>{newCommunityPosts > 9 ? '9+' : newCommunityPosts}</span>
                    )}
                    <div style={{ fontSize: 18, marginBottom: 1 }}>👥</div><div style={quickNumStyle}>{newCommunityPosts === null ? '…' : newCommunityPosts > 0 ? newCommunityPosts : '—'}</div><div style={quickLabelStyle}>Communauté</div>
                  </div>
                </Link>
                <Link href="/defis" style={{ textDecoration: 'none' }}>
                  <div style={quickTileStyle}><div style={{ fontSize: 18, marginBottom: 1 }}>⚡</div><div style={quickNumStyle}>{activeChallengesCount}</div><div style={quickLabelStyle}>Défis</div></div>
                </Link>
              </div>

            </div>

            {/* ───────── COLONNE DROITE ───────── */}
            <div>

              <div style={{ padding: '2px 4px 8px', fontSize: 9, color: '#8b6f55', textTransform: 'uppercase', letterSpacing: '2.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, transparent, rgba(139,90,60,0.3), transparent)' }} />
                Tous les modules
                <span style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, transparent, rgba(139,90,60,0.3), transparent)' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 10 }}>
                {MODULES_GRID.map((mod) => {
                  const t = modTones[mod.tone]
                  return (
                    <Link key={mod.href} href={mod.href} style={{ textDecoration: 'none' }}>
                      <div style={{ background: t.tile, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: `1px solid ${t.border}`, borderRadius: 13, padding: '9px 10px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 3px 10px rgba(139,90,60,0.06)' }}>
                        <div style={{ ...modIconBaseStyle, background: t.icon }}>{mod.emoji}</div>
                        <div style={{ fontSize: 12, color: '#3d2618', fontWeight: 600, lineHeight: 1.1 }}>{mod.title}</div>
                      </div>
                    </Link>
                  )
                })}
                <AdminTile />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center', paddingRight: 4 }}>
                <button onClick={restartTour} style={{ padding: '6px 13px', background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(212,165,116,0.35)', borderRadius: 999, fontSize: 11, color: '#5c4530', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>🎓 Tuto</button>
                <Link href="/settings" style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(212,165,116,0.35)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, textDecoration: 'none' }}>⚙️</Link>
              </div>

            </div>

          </div>
        </main>

        <style jsx>{`
          .home-main { width: 100%; max-width: 600px; margin: 0 auto; padding: 16px 18px 24px; }
          .home-grid { display: grid; grid-template-columns: 1fr; gap: 0; }
          @media (min-width: 900px) {
            .home-main { max-width: 1060px; }
            .home-grid { grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
          }
          @keyframes micPulse {
            0%, 100% { box-shadow: 0 6px 18px rgba(176,125,90,0.45), 0 0 0 0 rgba(196,149,106,0.55); }
            50% { box-shadow: 0 6px 18px rgba(176,125,90,0.45), 0 0 0 9px rgba(196,149,106,0); }
          }
          .mic-cta { animation: micPulse 2.2s ease-in-out infinite; }
        `}</style>

      </div>
    </>
  )
}

const micButtonStyle: React.CSSProperties = {
  width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 19, background: 'linear-gradient(135deg, #c4956a 0%, #b07d5a 55%, #c98b86 100%)',
  boxShadow: '0 6px 18px rgba(176,125,90,0.45), 0 0 0 3px rgba(196,149,106,0.12)', cursor: 'pointer',
}
const novaButtonStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999,
  background: 'linear-gradient(135deg, #c4956a 0%, #b07d5a 55%, #c98b86 100%)', color: '#fff',
  fontFamily: "'Cormorant Garamond', serif", fontSize: 15, fontWeight: 600, letterSpacing: '0.4px',
  boxShadow: '0 6px 18px rgba(176,125,90,0.45), 0 0 0 3px rgba(196,149,106,0.12)', whiteSpace: 'nowrap',
}
const quickTileStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0.25))',
  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.5)',
  borderRadius: 14, padding: '9px 4px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center',
  gap: 2, boxShadow: '0 3px 10px rgba(139,90,60,0.06)', position: 'relative',
}
const quickNumStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 600, color: '#3d2618', lineHeight: 1,
}
const quickLabelStyle: React.CSSProperties = {
  fontSize: 8.5, color: '#6b5340', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, textAlign: 'center', lineHeight: 1.1,
}
const modIconBaseStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0,
}
const modTones: Record<string, { tile: string; icon: string; border: string }> = {
  'ic-programme': { tile: 'rgba(243,205,182,0.42)', icon: 'linear-gradient(135deg,#F3CDB6,#E6B493)', border: 'rgba(230,180,147,0.6)' },
  'ic-planner':   { tile: 'rgba(194,215,232,0.42)', icon: 'linear-gradient(135deg,#C2D7E8,#A2C1DA)', border: 'rgba(162,193,218,0.6)' },
  'ic-tracker':   { tile: 'rgba(197,211,180,0.42)', icon: 'linear-gradient(135deg,#C5D3B4,#A7BD90)', border: 'rgba(167,189,144,0.6)' },
  'ic-routines':  { tile: 'rgba(245,216,155,0.42)', icon: 'linear-gradient(135deg,#F5D89B,#E7C06F)', border: 'rgba(231,192,111,0.6)' },
  'ic-agent':     { tile: 'rgba(212,196,226,0.42)', icon: 'linear-gradient(135deg,#D4C4E2,#B9A2D4)', border: 'rgba(185,162,212,0.6)' },
  'ic-recettes':  { tile: 'rgba(242,194,182,0.42)', icon: 'linear-gradient(135deg,#F2C2B6,#DFA08F)', border: 'rgba(223,160,143,0.6)' },
  'ic-famille':   { tile: 'rgba(185,215,203,0.42)', icon: 'linear-gradient(135deg,#B9D7CB,#94BFAC)', border: 'rgba(148,191,172,0.6)' },
  'ic-notes':     { tile: 'rgba(233,216,192,0.5)',  icon: 'linear-gradient(135deg,#E9D8C0,#D2B996)', border: 'rgba(210,185,150,0.65)' },
  'ic-astuces':   { tile: 'rgba(244,226,162,0.5)',  icon: 'linear-gradient(135deg,#F4E2A2,#E4CD72)', border: 'rgba(228,205,114,0.65)' },
}