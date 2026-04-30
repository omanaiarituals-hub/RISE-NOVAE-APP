'use client'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { UserMenu } from '@/components/UserMenu'
import { OnboardingTour } from '@/components/OnboardingTour'

// ─────────────────────────────────────────────
// THÈME ADAPTATIF
// ─────────────────────────────────────────────
// isDark = true  → fond foncé → cartes beige/crème claires
// isDark = false → fond clair → cartes sombres

interface Theme {
  isDark: boolean
  // Cartes principales
  cardBg: string
  cardBorder: string
  cardText: string
  cardSubtext: string
  // Top bar / bottom nav
  navBg: string
  navBorder: string
  navText: string
  // Séparateur
  divider: string
  // Bouton modules
  btnBg: string
  btnBorder: string
  btnText: string
}

function buildTheme(isDark: boolean): Theme {
  if (isDark) {
    // Fond sombre → éléments clairs (beige/crème)
    return {
      isDark,
      cardBg:      'rgba(253,248,242,0.14)',
      cardBorder:  'rgba(253,248,242,0.18)',
      cardText:    '#FFFFFF',
      cardSubtext: 'rgba(255,255,255,0.55)',
      navBg:       'rgba(253,248,242,0.10)',
      navBorder:   'rgba(253,248,242,0.12)',
      navText:     'rgba(255,255,255,0.65)',
      divider:     'rgba(255,255,255,0.10)',
      btnBg:       'rgba(253,248,242,0.08)',
      btnBorder:   'rgba(253,248,242,0.14)',
      btnText:     'rgba(255,255,255,0.5)',
    }
  } else {
    // Fond clair → éléments sombres
    return {
      isDark,
      cardBg:      'rgba(26,26,26,0.70)',
      cardBorder:  'rgba(26,26,26,0.18)',
      cardText:    '#FFFFFF',
      cardSubtext: 'rgba(255,255,255,0.55)',
      navBg:       'rgba(26,26,26,0.75)',
      navBorder:   'rgba(26,26,26,0.15)',
      navText:     'rgba(255,255,255,0.65)',
      divider:     'rgba(26,26,26,0.15)',
      btnBg:       'rgba(26,26,26,0.10)',
      btnBorder:   'rgba(26,26,26,0.14)',
      btnText:     'rgba(255,255,255,0.55)',
    }
  }
}

// Calcule luminosité d'une couleur hex (#rrggbb)
function hexLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  // Luminance perceptuelle
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// ─────────────────────────────────────────────
// SAISONNALITÉ
// ─────────────────────────────────────────────

const MONTHLY_CONFIG = [
  { month: 1,  query: 'winter+minimal+snow+landscape'  },
  { month: 2,  query: 'frost+morning+minimal+nature'   },
  { month: 3,  query: 'spring+bloom+minimal+pastel'    },
  { month: 4,  query: 'rain+soft+light+minimal+green'  },
  { month: 5,  query: 'green+nature+minimal+field'     },
  { month: 6,  query: 'golden+hour+minimal+summer'     },
  { month: 7,  query: 'summer+light+airy+sky+minimal'  },
  { month: 8,  query: 'dry+field+golden+minimal+sun'   },
  { month: 9,  query: 'autumn+light+minimal+leaves'    },
  { month: 10, query: 'fog+forest+minimal+autumn'      },
  { month: 11, query: 'bare+tree+minimal+grey+sky'     },
  { month: 12, query: 'night+blue+minimal+winter+calm' },
]

const UNSPLASH_KEY = 'IQRcRQdwRp9HiiI9rPFVMB7MfXp03UuG7LHQSN1Hs44'
const CACHE_PREFIX = 'novae-seasonal-bg-'

const FALLBACK: Record<number, { url: string; dark: boolean }> = {
  1:  { url: 'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=1200&q=75', dark: true  },
  2:  { url: 'https://images.unsplash.com/photo-1485236715568-ddc5ee6ca227?w=1200&q=75', dark: true  },
  3:  { url: 'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=1200&q=75', dark: false },
  4:  { url: 'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=1200&q=75', dark: false },
  5:  { url: 'https://images.unsplash.com/photo-1490750967868-88df5691cc11?w=1200&q=75', dark: false },
  6:  { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=75', dark: false },
  7:  { url: 'https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=1200&q=75', dark: false },
  8:  { url: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200&q=75', dark: false },
  9:  { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=75', dark: false },
  10: { url: 'https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=1200&q=75', dark: true  },
  11: { url: 'https://images.unsplash.com/photo-1482192505345-5852583c8e98?w=1200&q=75', dark: true  },
  12: { url: 'https://images.unsplash.com/photo-1418985991508-e47386d96a71?w=1200&q=75', dark: true  },
}

function useSeasonalBg() {
  const [bgUrl, setBgUrl] = useState('')
  const [isDark, setIsDark] = useState(true) // défaut sombre en attendant

  useEffect(() => {
    const month = new Date().getMonth() + 1
    const config = MONTHLY_CONFIG.find(c => c.month === month) || MONTHLY_CONFIG[0]
    const key = `${CACHE_PREFIX}${month}`

    const cached = localStorage.getItem(key)
    if (cached) {
      try {
        const d = JSON.parse(cached)
        if (d.month === month && d.url) {
          setBgUrl(d.url)
          setIsDark(d.isDark ?? true)
          return
        }
      } catch {}
    }

    ;(async () => {
      try {
        const res = await fetch(
          `https://api.unsplash.com/photos/random?query=${config.query}&orientation=landscape&content_filter=high`,
          { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }
        )
        if (!res.ok) throw new Error()
        const data = await res.json()
        const url = data.urls?.regular || data.urls?.full

        // Unsplash fournit color = couleur dominante de l'image (#rrggbb)
        const dominantColor: string = data.color || '#888888'
        const lum = hexLuminance(dominantColor)
        // On applique aussi le filtre brightness(0.45) côté CSS,
        // donc on abaisse le seuil : > 0.25 = image claire même après filtre
        const dark = lum < 0.25

        localStorage.setItem(key, JSON.stringify({ url, month, isDark: dark }))
        setBgUrl(url)
        setIsDark(dark)
      } catch {
        const fallback = FALLBACK[month] || FALLBACK[4]
        setBgUrl(fallback.url)
        setIsDark(fallback.dark)
      }
    })()
  }, [])

  return { bgUrl, isDark }
}

// ─────────────────────────────────────────────
// DONNÉES
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
  const { bgUrl, isDark } = useSeasonalBg()
  const t = buildTheme(isDark)

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
  const [newCommunityPosts, setNewCommunityPosts] = useState(0)

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
    const v = localStorage.getItem('novae-onboarding-version')
    if (v !== 'v2') {
      localStorage.removeItem('novae-onboarding-done')
      localStorage.setItem('novae-onboarding-version', 'v2')
    }
  }, [])

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
      setCurrentDay(d); setProgramProgress(Math.round((d/90)*100)); setStreak(prog.data.streak||0)
    }
    const tk = tasks.data || []; setTodayTasks(tk); setTodayTasksDone(tk.filter((x:any) => x.status==='completed').length)
    const rt = routines.data || []; setRoutinesTotal(rt.length); setRoutinesDone(rt.filter((x:any) => x.completed).length)
    try {
      const since = localStorage.getItem('novae-community-last-visit') || new Date(Date.now()-7*24*60*60*1000).toISOString()
      const { count } = await supabase.from('community_posts').select('*',{count:'exact',head:true}).gt('created_at', since)
      setNewCommunityPosts(count||0)
    } catch {}
  }

  const restartTour = () => {
    localStorage.removeItem('novae-onboarding-done')
    setShowTour(true)
    window.dispatchEvent(new CustomEvent('novae-restart-tour'))
  }

  const phaseInfo = PHASE_MESSAGES[getPhase(currentDay)]

  // Style carte réutilisable via thème
  const card = {
    background: t.cardBg,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: `1px solid ${t.cardBorder}`,
  }

  return (
    <>
      <OnboardingTour forceShow={showTour} onClose={() => setShowTour(false)} />

      {/* ── FOND D'ÉCRAN SAISONNIER ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background: bgUrl ? `url(${bgUrl}) center/cover no-repeat fixed` : '#1A1A14',
        filter: 'brightness(0.5) saturate(0.75)',
        transition: 'background-image 1.2s ease',
      }} />
      {/* Voile adaptatif : plus léger si fond déjà sombre, plus dense si fond clair */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1,
        background: isDark ? 'rgba(10,8,6,0.38)' : 'rgba(10,8,6,0.52)',
      }} />

      <div style={{ minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", position: 'relative', zIndex: 2 }}>

        {/* ── TOP BAR ── */}
        <div style={{
          background: t.navBg,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: `1px solid ${t.navBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px',
          position: 'sticky', top: 0, zIndex: 30,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: '#D4A090' }}>
              Novae
            </span>
            {currentDay > 0 && (
              <span style={{ fontSize: 11, color: '#C4956A', background: 'rgba(196,149,106,0.18)', padding: '2px 10px', borderRadius: 20, fontWeight: 500 }}>
                Jour {currentDay}/90
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {newCommunityPosts > 0 && (
              <Link href="/community"
                onClick={() => localStorage.setItem('novae-community-last-visit', new Date().toISOString())}
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(245,208,220,0.14)', border: '1px solid rgba(224,160,184,0.25)', borderRadius: 20, padding: '4px 10px' }}>
                <span style={{ fontSize: 13 }}>💬</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#F0B8C8' }}>{newCommunityPosts} message{newCommunityPosts > 1 ? 's' : ''}</span>
              </Link>
            )}
            {user ? <UserMenu /> : (
              <Link href="/auth" style={{ padding: '8px 20px', borderRadius: 20, border: `1.5px solid rgba(212,160,144,0.45)`, background: 'rgba(255,255,255,0.06)', color: '#D4A090', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                Se connecter
              </Link>
            )}
          </div>
        </div>

        <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px 120px' }}>

          {/* ── HERO ── */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 13, color: t.cardSubtext, margin: '0 0 4px' }}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 600, color: t.cardText, margin: '0 0 6px', lineHeight: 1.15 }}>
              {greeting}{pseudo ? `, ${pseudo}` : ''} 👋
            </h1>
            {currentDay > 0 && (
              <p style={{ fontSize: 14, color: t.cardSubtext, margin: 0, fontStyle: 'italic' }}>{dailyMessage}</p>
            )}
          </div>

          {/* ── CARTE PROGRAMME ── */}
          {user && currentDay > 0 && (
            <Link href="/program" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
              <div style={{ ...card, borderRadius: 20, padding: '24px', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
                <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(196,149,106,0.08)', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: t.cardSubtext, display: 'block', marginBottom: 4 }}>
                      {phaseInfo.label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 52, fontWeight: 600, color: t.cardText, lineHeight: 1 }}>{currentDay}</span>
                      <span style={{ fontSize: 18, color: t.cardSubtext, fontWeight: 300 }}>/90</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {streak > 0 && (
                      <div style={{ background: 'rgba(255,165,0,0.12)', border: '1px solid rgba(255,165,0,0.22)', borderRadius: 10, padding: '6px 12px', marginBottom: 8 }}>
                        <span style={{ fontSize: 14 }}>🔥</span>
                        <span style={{ fontSize: 12, color: '#FFA500', fontWeight: 600, marginLeft: 4 }}>{streak} jours</span>
                      </div>
                    )}
                    <span style={{ fontSize: 11, color: t.cardSubtext }}>{programProgress}% accompli</span>
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 4, height: 4, marginBottom: 14, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${programProgress}%`, background: 'linear-gradient(90deg, #C4956A, #E8B48A)', borderRadius: 4, transition: 'width 1s ease' }} />
                </div>
                <p style={{ fontSize: 13, color: t.cardSubtext, margin: '0 0 16px', lineHeight: 1.5 }}>{phaseInfo.message}</p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#C4956A', borderRadius: 10, padding: '10px 18px' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Voir ma mission du jour</span>
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>→</span>
                </div>
              </div>
            </Link>
          )}

          {/* ── 3 TUILES ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            <Link href="/planner" style={{ textDecoration: 'none' }}>
              <div style={{ ...card, borderRadius: 14, padding: '14px 12px', textAlign: 'center' }}>
                <span style={{ fontSize: 22, display: 'block', marginBottom: 6 }}>📋</span>
                <div style={{ fontSize: 20, fontWeight: 700, color: t.cardText, fontFamily: "'Cormorant Garamond', serif", lineHeight: 1 }}>
                  {todayTasksDone}/{todayTasks.length || 0}
                </div>
                <div style={{ fontSize: 10, color: t.cardSubtext, marginTop: 3, fontWeight: 500 }}>tâches</div>
                {todayTasks.length > 0 && todayTasksDone === todayTasks.length && (
                  <div style={{ fontSize: 10, color: '#4CAF50', marginTop: 4, fontWeight: 600 }}>✓ Tout fait !</div>
                )}
              </div>
            </Link>

            <Link href="/routines" style={{ textDecoration: 'none' }}>
              <div style={{ ...card, borderRadius: 14, padding: '14px 12px', textAlign: 'center' }}>
                <span style={{ fontSize: 22, display: 'block', marginBottom: 6 }}>☀️</span>
                <div style={{ fontSize: 20, fontWeight: 700, color: t.cardText, fontFamily: "'Cormorant Garamond', serif", lineHeight: 1 }}>
                  {routinesDone}/{routinesTotal || 0}
                </div>
                <div style={{ fontSize: 10, color: t.cardSubtext, marginTop: 3, fontWeight: 500 }}>routines</div>
                {routinesTotal > 0 && routinesDone === routinesTotal && (
                  <div style={{ fontSize: 10, color: '#4CAF50', marginTop: 4, fontWeight: 600 }}>✓ Parfait !</div>
                )}
              </div>
            </Link>

            <Link href="/agent" style={{ textDecoration: 'none' }}>
              <div style={{ background: 'rgba(196,149,106,0.16)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(196,149,106,0.25)', borderRadius: 14, padding: '14px 12px', textAlign: 'center' }}>
                <span style={{ fontSize: 22, display: 'block', marginBottom: 6 }}>🤖</span>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#C4956A', lineHeight: 1.2 }}>Agent</div>
                <div style={{ fontSize: 10, color: t.cardSubtext, marginTop: 3, fontWeight: 500 }}>NOVAÉ</div>
                <div style={{ fontSize: 9, color: '#C4956A', marginTop: 4, fontWeight: 600 }}>● Connecté</div>
              </div>
            </Link>
          </div>

          {/* ── INTENTION ── */}
          {intention ? (
            <div style={{ ...card, borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>✨</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#C4956A', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 3px' }}>Mon intention</p>
                <p style={{ fontSize: 15, color: t.cardText, fontStyle: 'italic', margin: 0, fontFamily: "'Cormorant Garamond', serif" }}>"{intention}"</p>
              </div>
              <Link href="/routines" style={{ fontSize: 11, color: '#C4956A', textDecoration: 'none', flexShrink: 0 }}>Modifier →</Link>
            </div>
          ) : (
            <Link href="/routines" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
              <div style={{ background: 'rgba(196,149,106,0.09)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px dashed rgba(196,149,106,0.3)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>✨</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#C4956A', margin: '0 0 2px' }}>Définir mon intention du jour</p>
                  <p style={{ fontSize: 11, color: t.cardSubtext, margin: 0 }}>Commence avec clarté et focus</p>
                </div>
                <span style={{ color: '#C4956A', fontSize: 16 }}>→</span>
              </div>
            </Link>
          )}

          {/* ── BOUTON PRINCIPAL ── */}
          <Link href="/program" style={{ textDecoration: 'none', display: 'block', marginBottom: 20 }}>
            <div style={{ background: '#C4956A', borderRadius: 14, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 24px rgba(196,149,106,0.35)', cursor: 'pointer' }}>
              <span style={{ fontSize: 16 }}>🎯</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'white', letterSpacing: '0.02em' }}>Commencer ma journée</span>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>→</span>
            </div>
          </Link>

          {/* ── COMMUNAUTÉ ── */}
          {newCommunityPosts > 0 && (
            <Link href="/community" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}
              onClick={() => localStorage.setItem('novae-community-last-visit', new Date().toISOString())}>
              <div style={{ ...card, borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(224,160,184,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>💬</div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: t.cardText }}>Communauté NOVAÉ</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: t.cardSubtext }}>{newCommunityPosts} nouveau{newCommunityPosts > 1 ? 'x' : ''} message{newCommunityPosts > 1 ? 's' : ''} depuis ta dernière visite</p>
                </div>
                <div style={{ background: '#D4856A', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0 }}>{newCommunityPosts}</div>
                <span style={{ color: '#C4956A', fontSize: 16 }}>→</span>
              </div>
            </Link>
          )}

          {/* ── SÉPARATEUR MODULES ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: t.divider }} />
            <button onClick={() => setShowModules(!showModules)}
              style={{ fontSize: 11, color: t.btnText, background: t.btnBg, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: `1px solid ${t.btnBorder}`, borderRadius: 20, padding: '5px 14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              {showModules ? '▲' : '▼'} Tous les modules
            </button>
            <div style={{ flex: 1, height: 1, background: t.divider }} />
          </div>

          {showModules && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
              {modules.map(mod => (
                <Link key={mod.href} href={mod.href} style={{ textDecoration: 'none' }}>
                  <div style={{ ...card, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{mod.emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: t.cardText }}>{mod.title}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

        </main>

        {/* ── BOUTONS FIXES ── */}
        <div style={{ position: 'fixed', bottom: 70, right: 16, zIndex: 50, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={restartTour} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 20, background: t.navBg, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: `1px solid ${t.navBorder}`, boxShadow: '0 2px 12px rgba(0,0,0,0.3)', fontSize: 11, color: t.navText, cursor: 'pointer' }}>
            🎓 Tuto
          </button>
          <Link href="/settings" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 20, background: t.navBg, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: `1px solid ${t.navBorder}`, boxShadow: '0 2px 12px rgba(0,0,0,0.3)', textDecoration: 'none', fontSize: 11, color: t.navText }}>
            ⚙️
          </Link>
        </div>

        {/* ── BOTTOM NAV MOBILE ── */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: t.navBg, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderTop: `1px solid ${t.navBorder}`, display: 'flex', overflowX: 'auto', padding: '6px 8px', gap: 2, zIndex: 40 }} className="md:hidden">
          {modules.slice(0, 6).map(mod => (
            <Link key={mod.href} href={mod.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 8px', borderRadius: 10, textDecoration: 'none', minWidth: 52, flexShrink: 0 }}>
              <span style={{ fontSize: 18 }}>{mod.emoji}</span>
              <span style={{ fontSize: 9, color: t.navText, marginTop: 2 }}>{mod.title.split(' ')[0]}</span>
            </Link>
          ))}
          <button onClick={() => setShowModules(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 8px', borderRadius: 10, border: 'none', background: 'none', cursor: 'pointer', minWidth: 52, flexShrink: 0 }}>
            <span style={{ fontSize: 18 }}>⋯</span>
            <span style={{ fontSize: 9, color: t.navText, marginTop: 2 }}>Plus</span>
          </button>
        </div>

      </div>
    </>
  )
}