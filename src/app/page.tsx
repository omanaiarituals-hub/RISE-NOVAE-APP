'use client'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { UserMenu } from '@/components/UserMenu'
import { OnboardingTour } from '@/components/OnboardingTour'

// ─────────────────────────────────────────────
// SAISONNALITÉ
// ─────────────────────────────────────────────

const MONTHLY_CONFIG = [
  { month: 1,  query: 'winter+snow+forest+minimal',     label: 'Janvier'   },
  { month: 2,  query: 'frost+morning+nature+minimal',   label: 'Février'   },
  { month: 3,  query: 'spring+cherry+blossom+minimal',  label: 'Mars'      },
  { month: 4,  query: 'rain+green+leaves+bokeh',        label: 'Avril'     },
  { month: 5,  query: 'may+flowers+field+golden+light', label: 'Mai'       },
  { month: 6,  query: 'golden+hour+summer+minimal',     label: 'Juin'      },
  { month: 7,  query: 'summer+sky+beach+light+airy',    label: 'Juillet'   },
  { month: 8,  query: 'golden+wheat+field+sun',         label: 'Août'      },
  { month: 9,  query: 'autumn+leaves+warm+light',       label: 'Septembre' },
  { month: 10, query: 'fog+forest+autumn+moody',        label: 'Octobre'   },
  { month: 11, query: 'bare+tree+grey+sky+minimal',     label: 'Novembre'  },
  { month: 12, query: 'snow+night+winter+blue+calm',    label: 'Décembre'  },
]

const UNSPLASH_KEY = 'IQRcRQdwRp9HiiI9rPFVMB7MfXp03UuG7LHQSN1Hs44'
const CACHE_PREFIX = 'novae-bg-v2-'

// Fallbacks garantis par mois — images testées
const FALLBACK: Record<number, { url: string; dark: boolean }> = {
  1:  { url: 'https://images.unsplash.com/photo-1551582045-6ec9c11d8697?w=1400&q=80', dark: true  },
  2:  { url: 'https://images.unsplash.com/photo-1485236715568-ddc5ee6ca227?w=1400&q=80', dark: true  },
  3:  { url: 'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=1400&q=80', dark: false },
  4:  { url: 'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=1400&q=80', dark: false },
  5:  { url: 'https://images.unsplash.com/photo-1490750967868-88df5691cc11?w=1400&q=80', dark: false },
  6:  { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1400&q=80', dark: false },
  7:  { url: 'https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=1400&q=80', dark: false },
  8:  { url: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1400&q=80', dark: false },
  9:  { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1400&q=80', dark: false },
  10: { url: 'https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=1400&q=80', dark: true  },
  11: { url: 'https://images.unsplash.com/photo-1482192505345-5852583c8e98?w=1400&q=80', dark: true  },
  12: { url: 'https://images.unsplash.com/photo-1418985991508-e47386d96a71?w=1400&q=80', dark: true  },
}

function hexLuminance(hex: string): number {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0,2), 16) / 255
  const g = parseInt(h.slice(2,4), 16) / 255
  const b = parseInt(h.slice(4,6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function useSeasonalBg() {
  const month = new Date().getMonth() + 1
  const fallback = FALLBACK[month] || FALLBACK[5]
  const [bgUrl, setBgUrl] = useState(fallback.url) // fallback immédiat
  const [isDark, setIsDark] = useState(fallback.dark)

  useEffect(() => {
    const key = `${CACHE_PREFIX}${month}`
    // Vide le cache si mois différent
    const cached = localStorage.getItem(key)
    if (cached) {
      try {
        const d = JSON.parse(cached)
        if (d.month === month && d.url) {
          setBgUrl(d.url)
          setIsDark(d.isDark ?? fallback.dark)
          return
        } else {
          localStorage.removeItem(key)
        }
      } catch { localStorage.removeItem(key) }
    }
    // Charge depuis Unsplash
    const config = MONTHLY_CONFIG.find(c => c.month === month) || MONTHLY_CONFIG[4]
    ;(async () => {
      try {
        const res = await fetch(
          `https://api.unsplash.com/photos/random?query=${config.query}&orientation=landscape&content_filter=high`,
          { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }
        )
        if (!res.ok) throw new Error()
        const data = await res.json()
        const url = data.urls?.regular || data.urls?.full
        if (!url) throw new Error()
        const dominant = data.color || '#888'
        const dark = hexLuminance(dominant) < 0.3
        localStorage.setItem(key, JSON.stringify({ url, month, isDark: dark }))
        setBgUrl(url)
        setIsDark(dark)
      } catch {
        // Garde le fallback déjà affiché
      }
    })()
  }, [])

  return { bgUrl, isDark }
}

// ─────────────────────────────────────────────
// THÈME ADAPTATIF
// ─────────────────────────────────────────────

interface Theme {
  isDark: boolean
  // Textes
  title: string
  subtitle: string
  // Nav / cartes
  navBg: string
  navBorder: string
  navText: string
  // Carte programme (grande)
  cardBg: string
  cardBorder: string
  cardText: string
  cardSub: string
  // Tuiles 3 stats
  tileBg: string
  tileBorder: string
  tileText: string
  tileSub: string
  // Divider
  divider: string
  // Bouton modules
  btnBg: string
  btnText: string
}

function buildTheme(isDark: boolean): Theme {
  if (isDark) {
    return {
      isDark,
      title: '#FFFFFF',
      subtitle: 'rgba(255,255,255,0.55)',
      navBg: 'rgba(253,248,242,0.10)',
      navBorder: 'rgba(253,248,242,0.12)',
      navText: 'rgba(255,255,255,0.7)',
      cardBg: 'rgba(253,248,242,0.10)',
      cardBorder: 'rgba(253,248,242,0.15)',
      cardText: '#FFFFFF',
      cardSub: 'rgba(255,255,255,0.5)',
      tileBg: 'rgba(253,248,242,0.10)',
      tileBorder: 'rgba(253,248,242,0.12)',
      tileText: '#FFFFFF',
      tileSub: 'rgba(255,255,255,0.45)',
      divider: 'rgba(255,255,255,0.12)',
      btnBg: 'rgba(253,248,242,0.10)',
      btnText: 'rgba(255,255,255,0.6)',
    }
  }
  return {
    isDark,
    title: '#1A1A1A',
    subtitle: 'rgba(26,26,26,0.55)',
    navBg: 'rgba(26,26,26,0.65)',
    navBorder: 'rgba(26,26,26,0.18)',
    navText: 'rgba(255,255,255,0.75)',
    cardBg: 'rgba(26,26,26,0.60)',
    cardBorder: 'rgba(26,26,26,0.20)',
    cardText: '#FFFFFF',
    cardSub: 'rgba(255,255,255,0.5)',
    tileBg: 'rgba(26,26,26,0.55)',
    tileBorder: 'rgba(26,26,26,0.18)',
    tileText: '#FFFFFF',
    tileSub: 'rgba(255,255,255,0.45)',
    divider: 'rgba(26,26,26,0.18)',
    btnBg: 'rgba(26,26,26,0.12)',
    btnText: 'rgba(255,255,255,0.6)',
  }
}

// ─────────────────────────────────────────────
// COULEURS MODULES — toujours différentes, adaptées au fond
// ─────────────────────────────────────────────

// Couleurs pastel pour fond foncé (tons clairs)
const MODULE_COLORS_DARK = [
  { bg: 'rgba(212,160,144,0.28)', border: 'rgba(212,160,144,0.45)', text: '#F5D0C0' }, // rose poudré
  { bg: 'rgba(160,190,220,0.28)', border: 'rgba(160,190,220,0.45)', text: '#C0D8F0' }, // bleu ciel
  { bg: 'rgba(160,200,168,0.28)', border: 'rgba(160,200,168,0.45)', text: '#B8E8C0' }, // vert sage
  { bg: 'rgba(232,208,128,0.28)', border: 'rgba(232,208,128,0.45)', text: '#F0E0A0' }, // doré
  { bg: 'rgba(180,160,220,0.28)', border: 'rgba(180,160,220,0.45)', text: '#D0C0F0' }, // lavande
  { bg: 'rgba(220,160,180,0.28)', border: 'rgba(220,160,180,0.45)', text: '#F0C0D0' }, // rose
  { bg: 'rgba(140,200,200,0.28)', border: 'rgba(140,200,200,0.45)', text: '#B0E8E8' }, // turquoise
  { bg: 'rgba(220,180,140,0.28)', border: 'rgba(220,180,140,0.45)', text: '#F0D0B0' }, // abricot
  { bg: 'rgba(200,220,160,0.28)', border: 'rgba(200,220,160,0.45)', text: '#D8F0B8' }, // vert lime
  { bg: 'rgba(200,170,220,0.28)', border: 'rgba(200,170,220,0.45)', text: '#E8C8F8' }, // mauve
]

// Couleurs sombres pour fond clair (tons profonds)
const MODULE_COLORS_LIGHT = [
  { bg: 'rgba(180,80,60,0.18)',  border: 'rgba(180,80,60,0.35)',  text: '#8A2010' }, // terra
  { bg: 'rgba(40,80,160,0.18)', border: 'rgba(40,80,160,0.35)',  text: '#1A3A8A' }, // navy
  { bg: 'rgba(40,120,80,0.18)', border: 'rgba(40,120,80,0.35)',  text: '#1A6A3A' }, // forêt
  { bg: 'rgba(160,120,20,0.18)',border: 'rgba(160,120,20,0.35)', text: '#7A5A10' }, // bronze
  { bg: 'rgba(80,50,140,0.18)', border: 'rgba(80,50,140,0.35)',  text: '#3A1A7A' }, // violet
  { bg: 'rgba(160,40,80,0.18)', border: 'rgba(160,40,80,0.35)',  text: '#7A1A3A' }, // bordeaux
  { bg: 'rgba(20,120,120,0.18)',border: 'rgba(20,120,120,0.35)', text: '#0A5A5A' }, // sarcelle
  { bg: 'rgba(160,80,20,0.18)', border: 'rgba(160,80,20,0.35)',  text: '#7A3A0A' }, // rouille
  { bg: 'rgba(60,120,40,0.18)', border: 'rgba(60,120,40,0.35)',  text: '#2A5A1A' }, // olive
  { bg: 'rgba(100,40,140,0.18)',border: 'rgba(100,40,140,0.35)', text: '#4A1A7A' }, // prune
]

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
  const moduleColors = isDark ? MODULE_COLORS_DARK : MODULE_COLORS_LIGHT

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
    if (v !== 'v2') { localStorage.removeItem('novae-onboarding-done'); localStorage.setItem('novae-onboarding-version', 'v2') }
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

  const restartTour = () => { localStorage.removeItem('novae-onboarding-done'); setShowTour(true); window.dispatchEvent(new CustomEvent('novae-restart-tour')) }
  const phaseInfo = PHASE_MESSAGES[getPhase(currentDay)]

  const glass = (extraBg?: string) => ({
    background: extraBg || t.cardBg,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: `1px solid ${t.cardBorder}`,
  })

  return (
    <>
      <OnboardingTour forceShow={showTour} onClose={() => setShowTour(false)} />

      {/* ── FOND D'ÉCRAN SAISONNIER ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: `url(${bgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        filter: isDark ? 'brightness(0.42) saturate(0.7)' : 'brightness(0.75) saturate(0.85)',
        transition: 'background-image 1s ease',
      }} />
      {/* Voile adaptatif */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1,
        background: isDark ? 'rgba(8,6,4,0.45)' : 'rgba(240,235,225,0.30)',
      }} />

      <div style={{ minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", position: 'relative', zIndex: 2 }}>

        {/* ── TOP BAR ── */}
        <div style={{
          ...glass(),
          background: t.navBg,
          border: 'none',
          borderBottom: `1px solid ${t.navBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px',
          position: 'sticky', top: 0, zIndex: 30,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: '#D4A090' }}>Novae</span>
            {currentDay > 0 && (
              <span style={{ fontSize: 11, color: '#C4956A', background: 'rgba(196,149,106,0.18)', padding: '2px 10px', borderRadius: 20, fontWeight: 500 }}>
                Jour {currentDay}/90
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {newCommunityPosts > 0 && (
              <Link href="/community" onClick={() => localStorage.setItem('novae-community-last-visit', new Date().toISOString())}
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(245,208,220,0.15)', border: '1px solid rgba(224,160,184,0.25)', borderRadius: 20, padding: '4px 10px' }}>
                <span style={{ fontSize: 13 }}>💬</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#F0B8C8' }}>{newCommunityPosts}</span>
              </Link>
            )}
            {user ? <UserMenu /> : (
              <Link href="/auth" style={{ padding: '8px 20px', borderRadius: 20, border: '1.5px solid rgba(212,160,144,0.45)', background: 'rgba(255,255,255,0.08)', color: '#D4A090', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                Se connecter
              </Link>
            )}
          </div>
        </div>

        <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px 120px' }}>

          {/* ── HERO ── */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 13, color: t.subtitle, margin: '0 0 4px' }}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 600, color: t.title, margin: '0 0 6px', lineHeight: 1.15 }}>
              {greeting}{pseudo ? `, ${pseudo}` : ''} 👋
            </h1>
            {currentDay > 0 && (
              <p style={{ fontSize: 14, color: t.subtitle, margin: 0, fontStyle: 'italic' }}>{dailyMessage}</p>
            )}
          </div>

          {/* ── CARTE PROGRAMME ── */}
          {user && currentDay > 0 && (
            <Link href="/program" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
              <div style={{ ...glass(), borderRadius: 20, padding: '24px', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
                <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(196,149,106,0.10)', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: t.cardSub, display: 'block', marginBottom: 4 }}>
                      {phaseInfo.label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 52, fontWeight: 600, color: t.cardText, lineHeight: 1 }}>{currentDay}</span>
                      <span style={{ fontSize: 18, color: t.cardSub, fontWeight: 300 }}>/90</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {streak > 0 && (
                      <div style={{ background: 'rgba(255,165,0,0.12)', border: '1px solid rgba(255,165,0,0.25)', borderRadius: 10, padding: '6px 12px', marginBottom: 8 }}>
                        <span style={{ fontSize: 14 }}>🔥</span>
                        <span style={{ fontSize: 12, color: '#FFA500', fontWeight: 600, marginLeft: 4 }}>{streak}j</span>
                      </div>
                    )}
                    <span style={{ fontSize: 11, color: t.cardSub }}>{programProgress}% accompli</span>
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.10)', borderRadius: 4, height: 4, marginBottom: 14, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${programProgress}%`, background: 'linear-gradient(90deg, #C4956A, #E8B48A)', borderRadius: 4, transition: 'width 1s ease' }} />
                </div>
                <p style={{ fontSize: 13, color: t.cardSub, margin: '0 0 16px', lineHeight: 1.5 }}>{phaseInfo.message}</p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#C4956A', borderRadius: 10, padding: '10px 18px' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Voir ma mission du jour</span>
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>→</span>
                </div>
              </div>
            </Link>
          )}

          {/* ── 3 TUILES STATS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { href: '/planner',  emoji: '📋', value: `${todayTasksDone}/${todayTasks.length||0}`, label: 'tâches', color: moduleColors[0] },
              { href: '/routines', emoji: '☀️', value: `${routinesDone}/${routinesTotal||0}`, label: 'routines', color: moduleColors[4] },
              { href: '/agent',    emoji: '🤖', value: 'Agent', label: 'NOVAÉ', color: moduleColors[9], special: true },
            ].map((tile, i) => (
              <Link key={i} href={tile.href} style={{ textDecoration: 'none' }}>
                <div style={{ background: tile.color.bg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${tile.color.border}`, borderRadius: 14, padding: '14px 12px', textAlign: 'center' }}>
                  <span style={{ fontSize: 22, display: 'block', marginBottom: 6 }}>{tile.emoji}</span>
                  <div style={{ fontSize: 18, fontWeight: 700, color: tile.color.text, fontFamily: "'Cormorant Garamond', serif", lineHeight: 1 }}>{tile.value}</div>
                  <div style={{ fontSize: 10, color: tile.color.text, opacity: 0.7, marginTop: 3, fontWeight: 500 }}>{tile.label}</div>
                  {tile.special && <div style={{ fontSize: 9, color: tile.color.text, marginTop: 4, fontWeight: 600, opacity: 0.8 }}>● Connecté</div>}
                </div>
              </Link>
            ))}
          </div>

          {/* ── INTENTION ── */}
          {intention ? (
            <div style={{ ...glass(), borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>✨</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#C4956A', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 3px' }}>Mon intention</p>
                <p style={{ fontSize: 15, color: t.cardText, fontStyle: 'italic', margin: 0, fontFamily: "'Cormorant Garamond', serif" }}>"{intention}"</p>
              </div>
              <Link href="/routines" style={{ fontSize: 11, color: '#C4956A', textDecoration: 'none', flexShrink: 0 }}>Modifier →</Link>
            </div>
          ) : (
            <Link href="/routines" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
              <div style={{ background: 'rgba(196,149,106,0.10)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px dashed rgba(196,149,106,0.35)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>✨</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#C4956A', margin: '0 0 2px' }}>Définir mon intention du jour</p>
                  <p style={{ fontSize: 11, color: t.subtitle, margin: 0 }}>Commence avec clarté et focus</p>
                </div>
                <span style={{ color: '#C4956A', fontSize: 16 }}>→</span>
              </div>
            </Link>
          )}

          {/* ── BOUTON PRINCIPAL ── */}
          <Link href="/program" style={{ textDecoration: 'none', display: 'block', marginBottom: 20 }}>
            <div style={{ background: '#C4956A', borderRadius: 14, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 24px rgba(196,149,106,0.4)', cursor: 'pointer' }}>
              <span style={{ fontSize: 16 }}>🎯</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'white', letterSpacing: '0.02em' }}>Commencer ma journée</span>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>→</span>
            </div>
          </Link>

          {/* ── SÉPARATEUR MODULES ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: t.divider }} />
            <button onClick={() => setShowModules(!showModules)}
              style={{ fontSize: 11, color: t.btnText, background: t.btnBg, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: `1px solid ${t.divider}`, borderRadius: 20, padding: '5px 14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              {showModules ? '▲' : '▼'} Tous les modules
            </button>
            <div style={{ flex: 1, height: 1, background: t.divider }} />
          </div>

          {/* ── GRILLE MODULES — couleurs différentes par module ── */}
          {showModules && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
              {modules.map((mod, i) => {
                const mc = moduleColors[i % moduleColors.length]
                return (
                  <Link key={mod.href} href={mod.href} style={{ textDecoration: 'none' }}>
                    <div style={{ background: mc.bg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${mc.border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{mod.emoji}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: mc.text }}>{mod.title}</span>
                    </div>
                  </Link>
                )
              })}
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
          {modules.slice(0, 6).map((mod, i) => {
            const mc = moduleColors[i % moduleColors.length]
            return (
              <Link key={mod.href} href={mod.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 8px', borderRadius: 10, textDecoration: 'none', minWidth: 52, flexShrink: 0 }}>
                <span style={{ fontSize: 18 }}>{mod.emoji}</span>
                <span style={{ fontSize: 9, color: mc.text, marginTop: 2 }}>{mod.title.split(' ')[0]}</span>
              </Link>
            )
          })}
          <button onClick={() => setShowModules(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 8px', borderRadius: 10, border: 'none', background: 'none', cursor: 'pointer', minWidth: 52, flexShrink: 0 }}>
            <span style={{ fontSize: 18 }}>⋯</span>
            <span style={{ fontSize: 9, color: t.navText, marginTop: 2 }}>Plus</span>
          </button>
        </div>

      </div>
    </>
  )
}