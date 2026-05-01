'use client'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { UserMenu } from '@/components/UserMenu'
import { OnboardingTour } from '@/components/OnboardingTour'

// ─────────────────────────────────────────────
// 🖼️ IMAGE DE FOND — changer cette URL quand tu veux
// ─────────────────────────────────────────────
const BG_IMAGE = 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1600&q=85'
// Forêt brumeuse avec rayons de soleil dorés — Unsplash libre de droits

// ─────────────────────────────────────────────
// MODULES
// ─────────────────────────────────────────────
const modules = [
  { href: '/program',   emoji: '🎯', title: 'Programme 90j' },
  { href: '/planner',   emoji: '📅', title: 'Planner'        },
  { href: '/defis',     emoji: '⚡', title: 'Défis'          },
  { href: '/tracker',   emoji: '📊', title: 'Tracker'        },
  { href: '/routines',  emoji: '☀️', title: 'Routines'       },
  { href: '/agent',     emoji: '🤖', title: 'Agent IA'       },
  { href: '/recipes',   emoji: '🛒', title: 'Recettes'       },
  { href: '/family',    emoji: '💛', title: 'Famille'        },
  { href: '/notes',     emoji: '📝', title: 'Notes'          },
  { href: '/community', emoji: '👥', title: 'Communauté'     },
]

// 10 couleurs pastel distinctes — glassmorphism sur fond sombre
const MODULE_COLORS = [
  { bg: 'rgba(212,160,144,0.22)', border: 'rgba(212,160,144,0.38)', text: '#F2D5C8' }, // rose poudré
  { bg: 'rgba(160,190,220,0.22)', border: 'rgba(160,190,220,0.38)', text: '#C8DCF0' }, // bleu ciel
  { bg: 'rgba(140,200,168,0.22)', border: 'rgba(140,200,168,0.38)', text: '#B8E8C8' }, // vert sauge
  { bg: 'rgba(232,208,128,0.22)', border: 'rgba(232,208,128,0.38)', text: '#F0E4B0' }, // doré
  { bg: 'rgba(180,160,220,0.22)', border: 'rgba(180,160,220,0.38)', text: '#D8C8F8' }, // lavande
  { bg: 'rgba(220,160,180,0.22)', border: 'rgba(220,160,180,0.38)', text: '#F0C8D8' }, // rose
  { bg: 'rgba(140,210,210,0.22)', border: 'rgba(140,210,210,0.38)', text: '#B8F0F0' }, // turquoise
  { bg: 'rgba(220,180,140,0.22)', border: 'rgba(220,180,140,0.38)', text: '#F0D8B8' }, // abricot
  { bg: 'rgba(200,220,160,0.22)', border: 'rgba(200,220,160,0.38)', text: '#D8F0B8' }, // vert lime
  { bg: 'rgba(200,170,220,0.22)', border: 'rgba(200,170,220,0.38)', text: '#E8D0F8' }, // mauve
]

const PHASE_MESSAGES: Record<string, { label: string; message: string }> = {
  reprogrammation: { label: 'Phase 1 — Reprogrammation', message: 'Tu construis les fondations. Chaque petit geste compte.' },
  action:          { label: 'Phase 2 — Action & Discipline', message: "Tu passes à l'action. La régularité est ta force." },
  expansion:       { label: 'Phase 3 — Expansion', message: "Tu es en phase d'expansion. Continue à viser haut." },
}

const MOTIVATIONAL = [
  "Chaque jour est une nouvelle chance de te rapprocher de qui tu veux être.",
  "La discipline d'aujourd'hui est la liberté de demain.",
  "Tu n'as pas besoin de te motiver. Tu as besoin de commencer.",
  "Le progrès, pas la perfection.",
  "Une action simple aujourd'hui change tout demain.",
  "Tu avances plus que tu ne le crois.",
]

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function getPhase(day: number) {
  if (day <= 30) return 'reprogrammation'
  if (day <= 60) return 'action'
  return 'expansion'
}

// ─────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────
export default function HomePage() {
  const { user } = useSupabaseAuth()
  const router = useRouter()

  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [showModules, setShowModules] = useState(false)
  const [currentDay, setCurrentDay] = useState(0)
  const [programProgress, setProgramProgress] = useState(0)
  const [todayTasks, setTodayTasks] = useState<any[]>([])
  const [todayTasksDone, setTodayTasksDone] = useState(0)
  const [routinesDone, setRoutinesDone] = useState(0)
  const [routinesTotal, setRoutinesTotal] = useState(0)
  const [streak, setStreak] = useState(0)
  const [intention, setIntention] = useState<string | null>(null)
  const [dailyMessage, setDailyMessage] = useState('')

  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'Bonne nuit' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Bonne après-midi' : 'Bonsoir'
  const pseudo = user?.user_metadata?.pseudo || user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''

  useEffect(() => {
    if (!user || onboardingChecked) return
    ;(async () => {
      const { data } = await supabase.from('ai_personality_profile').select('id').eq('user_id', user.id).single()
      setOnboardingChecked(true)
      if (!data) router.push('/onboarding')
    })()
  }, [user])

  useEffect(() => {
    setDailyMessage(MOTIVATIONAL[new Date().getDate() % MOTIVATIONAL.length])
    const today = fmtDate(new Date())
    const saved = localStorage.getItem(`novae-reflection-${today}`)
    if (saved) { try { setIntention(JSON.parse(saved).morningIntention || null) } catch {} }
  }, [])

  useEffect(() => { if (user) loadData() }, [user])

  const loadData = async () => {
    if (!user) return
    const today = fmtDate(new Date())
    const [prog, tasks, routines] = await Promise.all([
      supabase.from('program_progress').select('*').eq('user_id', user.id).single(),
      supabase.from('tasks').select('*').eq('user_id', user.id).gte('date', today).lte('date', today + 'T23:59:59'),
      supabase.from('routines').select('*').eq('user_id', user.id),
    ])
    if (prog.data) {
      const d = prog.data.current_day || 1
      setCurrentDay(d)
      setProgramProgress(Math.round((d / 90) * 100))
      setStreak(prog.data.streak || 0)
    }
    const tk = tasks.data || []
    setTodayTasks(tk)
    setTodayTasksDone(tk.filter((x: any) => x.status === 'completed').length)
    const rt = routines.data || []
    setRoutinesTotal(rt.length)
    setRoutinesDone(rt.filter((x: any) => x.completed).length)
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

      {/* ── FOND FIXE ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: `url(${BG_IMAGE})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />
      {/* Voile gradient pour lisibilité */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.62) 100%)',
      }} />

      <div style={{ minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", position: 'relative', zIndex: 2 }}>

        {/* ── TOP BAR ── */}
        <div style={{
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.10)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px', position: 'sticky', top: 0, zIndex: 30,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: '#D4A090', letterSpacing: '0.05em' }}>Novae</span>
            {currentDay > 0 && (
              <span style={{ fontSize: 11, color: '#C4956A', background: 'rgba(196,149,106,0.20)', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>
                Jour {currentDay}/90
              </span>
            )}
          </div>
          {user ? <UserMenu /> : (
            <Link href="/auth" style={{ padding: '8px 20px', borderRadius: 20, border: '1.5px solid rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
              Se connecter
            </Link>
          )}
        </div>

        <main style={{ maxWidth: 600, margin: '0 auto', padding: '28px 20px 120px' }}>

          {/* ── SALUTATION ── */}
          <div style={{ marginBottom: 26 }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.48)', margin: '0 0 4px' }}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 40, fontWeight: 600, color: '#FFFFFF', margin: '0 0 8px', lineHeight: 1.1 }}>
              {greeting}{pseudo ? `, ${pseudo}` : ''} 👋
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.50)', margin: 0, fontStyle: 'italic', lineHeight: 1.5 }}>
              {dailyMessage}
            </p>
          </div>

          {/* ── CARTE PROGRAMME ── */}
          {user && currentDay > 0 && (
            <Link href="/program" style={{ textDecoration: 'none', display: 'block', marginBottom: 12 }}>
              <div style={{
                background: 'rgba(255,255,255,0.09)',
                backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 20, padding: '22px 24px',
                boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)', display: 'block', marginBottom: 6 }}>
                      {phaseInfo.label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 54, fontWeight: 600, color: '#FFFFFF', lineHeight: 1 }}>{currentDay}</span>
                      <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.32)', fontWeight: 300 }}>/90</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    {streak > 0 && (
                      <div style={{ background: 'rgba(255,165,0,0.14)', border: '1px solid rgba(255,165,0,0.28)', borderRadius: 10, padding: '5px 10px' }}>
                        <span style={{ fontSize: 13 }}>🔥</span>
                        <span style={{ fontSize: 12, color: '#FFB84D', fontWeight: 600, marginLeft: 4 }}>{streak}j</span>
                      </div>
                    )}
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>{programProgress}% accompli</span>
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.10)', borderRadius: 4, height: 4, marginBottom: 12, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${programProgress}%`, background: 'linear-gradient(90deg, #C4956A, #E8B48A)', borderRadius: 4, transition: 'width 1s ease' }} />
                </div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.42)', margin: '0 0 18px', lineHeight: 1.6 }}>
                  {phaseInfo.message}
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#C4956A', borderRadius: 10, padding: '10px 20px', boxShadow: '0 4px 16px rgba(196,149,106,0.40)' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Voir ma mission du jour</span>
                  <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15 }}>→</span>
                </div>
              </div>
            </Link>
          )}

          {/* ── 3 TUILES STATS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            {[
              { href: '/planner',  emoji: '📋', value: `${todayTasksDone}/${todayTasks.length || 0}`, label: 'tâches',   mc: MODULE_COLORS[0] },
              { href: '/routines', emoji: '☀️', value: `${routinesDone}/${routinesTotal || 0}`,        label: 'routines', mc: MODULE_COLORS[4] },
              { href: '/agent',    emoji: '🤖', value: 'Agent',                                        label: 'NOVAÉ',    mc: MODULE_COLORS[9] },
            ].map((tile, i) => (
              <Link key={i} href={tile.href} style={{ textDecoration: 'none' }}>
                <div style={{ background: tile.mc.bg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${tile.mc.border}`, borderRadius: 14, padding: '16px 10px', textAlign: 'center' }}>
                  <span style={{ fontSize: 24, display: 'block', marginBottom: 6 }}>{tile.emoji}</span>
                  <div style={{ fontSize: 20, fontWeight: 700, color: tile.mc.text, fontFamily: "'Cormorant Garamond', serif", lineHeight: 1 }}>{tile.value}</div>
                  <div style={{ fontSize: 10, color: tile.mc.text, opacity: 0.75, marginTop: 4, fontWeight: 500 }}>{tile.label}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* ── INTENTION ── */}
          {intention ? (
            <div style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '14px 18px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>✨</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#C4956A', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 3px' }}>Mon intention</p>
                <p style={{ fontSize: 15, color: '#FFFFFF', fontStyle: 'italic', margin: 0, fontFamily: "'Cormorant Garamond', serif" }}>"{intention}"</p>
              </div>
              <Link href="/routines" style={{ fontSize: 11, color: '#C4956A', textDecoration: 'none', flexShrink: 0 }}>Modifier →</Link>
            </div>
          ) : (
            <Link href="/routines" style={{ textDecoration: 'none', display: 'block', marginBottom: 12 }}>
              <div style={{ background: 'rgba(196,149,106,0.10)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px dashed rgba(196,149,106,0.36)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>✨</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#C4956A', margin: '0 0 2px' }}>Définir mon intention du jour</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', margin: 0 }}>Commence avec clarté et focus</p>
                </div>
                <span style={{ color: '#C4956A', fontSize: 16 }}>→</span>
              </div>
            </Link>
          )}

          {/* ── BOUTON PRINCIPAL ── */}
          <Link href="/program" style={{ textDecoration: 'none', display: 'block', marginBottom: 28 }}>
            <div style={{ background: '#C4956A', borderRadius: 14, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 24px rgba(196,149,106,0.42)' }}>
              <span style={{ fontSize: 16 }}>🎯</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'white', letterSpacing: '0.02em' }}>Commencer ma journée</span>
              <span style={{ color: 'rgba(255,255,255,0.70)', fontSize: 16 }}>→</span>
            </div>
          </Link>

          {/* ── MODULES ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
            <button onClick={() => setShowModules(!showModules)} style={{ fontSize: 11, color: 'rgba(255,255,255,0.52)', background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '6px 16px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 6 }}>
              {showModules ? '▲' : '▼'} Tous les modules
            </button>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
          </div>

          {showModules && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {modules.map((mod, i) => {
                const mc = MODULE_COLORS[i % MODULE_COLORS.length]
                return (
                  <Link key={mod.href} href={mod.href} style={{ textDecoration: 'none' }}>
                    <div style={{ background: mc.bg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${mc.border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{mod.emoji}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: mc.text, lineHeight: 1.3 }}>{mod.title}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

        </main>

        {/* ── BOUTONS FIXES ── */}
        <div style={{ position: 'fixed', bottom: 74, right: 16, zIndex: 50, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={restartTour} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 20, background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', fontSize: 11, color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}>
            🎓 Tuto
          </button>
          <Link href="/settings" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px 13px', borderRadius: 20, background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', textDecoration: 'none', fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>
            ⚙️
          </Link>
        </div>

        {/* ── BOTTOM NAV ── */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', overflowX: 'auto', padding: '6px 8px', gap: 2, zIndex: 40 }} className="md:hidden">
          {modules.slice(0, 6).map((mod, i) => {
            const mc = MODULE_COLORS[i % MODULE_COLORS.length]
            return (
              <Link key={mod.href} href={mod.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 8px', borderRadius: 10, textDecoration: 'none', minWidth: 52, flexShrink: 0 }}>
                <span style={{ fontSize: 18 }}>{mod.emoji}</span>
                <span style={{ fontSize: 9, color: mc.text, marginTop: 2, textAlign: 'center' }}>{mod.title.split(' ')[0]}</span>
              </Link>
            )
          })}
          <button onClick={() => setShowModules(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 8px', borderRadius: 10, border: 'none', background: 'none', cursor: 'pointer', minWidth: 52, flexShrink: 0 }}>
            <span style={{ fontSize: 18 }}>⋯</span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.42)', marginTop: 2 }}>Plus</span>
          </button>
        </div>

      </div>
    </>
  )
}