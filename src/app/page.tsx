'use client'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { UserMenu } from '@/components/UserMenu'
import { OnboardingTour } from '@/components/OnboardingTour'

// ─────────────────────────────────────────────
// COMPOSANT BANNIÈRE SAISONNIÈRE (intégré directement)
// ─────────────────────────────────────────────

const MONTHLY_CONFIG = [
  { month: 1,  query: 'winter+minimal+snow+landscape',  label: 'Janvier',   mood: 'Silence et clarté'        },
  { month: 2,  query: 'frost+morning+minimal+nature',   label: 'Février',   mood: 'Lumière froide'           },
  { month: 3,  query: 'spring+bloom+minimal+pastel',    label: 'Mars',      mood: 'Premiers bourgeons'       },
  { month: 4,  query: 'rain+soft+light+minimal+green',  label: 'Avril',     mood: 'Pluie douce, renouveau'  },
  { month: 5,  query: 'green+nature+minimal+field',     label: 'Mai',       mood: 'Verdure fraîche'          },
  { month: 6,  query: 'golden+hour+minimal+summer',     label: 'Juin',      mood: 'Lumière chaude et longue' },
  { month: 7,  query: 'summer+light+airy+sky+minimal',  label: 'Juillet',   mood: 'Chaleur et ciel ouvert'   },
  { month: 8,  query: 'dry+field+golden+minimal+sun',   label: 'Août',      mood: 'Ocre et chaleur sèche'    },
  { month: 9,  query: 'autumn+light+minimal+leaves',    label: 'Septembre', mood: "L'or de la transition"    },
  { month: 10, query: 'fog+forest+minimal+autumn',      label: 'Octobre',   mood: 'Brume et profondeur'      },
  { month: 11, query: 'bare+tree+minimal+grey+sky',     label: 'Novembre',  mood: 'Dénudé, introspection'    },
  { month: 12, query: 'night+blue+minimal+winter+calm', label: 'Décembre',  mood: 'Bleu nuit, intériorité'   },
]

const UNSPLASH_ACCESS_KEY = 'IQRcRQdwRp9HiiI9rPFVMB7MfXp03UuG7LHQSN1Hs44'
const CACHE_PREFIX = 'novae-seasonal-img-'

const FALLBACK_IMAGES: Record<number, string> = {
  1:  'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=800&q=70',
  2:  'https://images.unsplash.com/photo-1485236715568-ddc5ee6ca227?w=800&q=70',
  3:  'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=800&q=70',
  4:  'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=800&q=70',
  5:  'https://images.unsplash.com/photo-1490750967868-88df5691cc11?w=800&q=70',
  6:  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=70',
  7:  'https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=800&q=70',
  8:  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=70',
  9:  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=70',
  10: 'https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=800&q=70',
  11: 'https://images.unsplash.com/photo-1482192505345-5852583c8e98?w=800&q=70',
  12: 'https://images.unsplash.com/photo-1418985991508-e47386d96a71?w=800&q=70',
}

interface BannerImage {
  url: string
  author: string
  authorUrl: string
  month: number
}

function HomeAestheticBanner() {
  const [image, setImage] = useState<BannerImage | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [showCredit, setShowCredit] = useState(true)

  const currentMonth = new Date().getMonth() + 1
  const config = MONTHLY_CONFIG.find(c => c.month === currentMonth) || MONTHLY_CONFIG[0]

  useEffect(() => {
    const cacheKey = `${CACHE_PREFIX}${currentMonth}`
    const cached = localStorage.getItem(cacheKey)

    if (cached) {
      try {
        const data = JSON.parse(cached)
        if (data.month === currentMonth) {
          setImage(data)
          return
        }
      } catch {}
    }

    ;(async () => {
      try {
        const res = await fetch(
          `https://api.unsplash.com/photos/random?query=${config.query}&orientation=landscape&content_filter=high`,
          { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
        )
        if (!res.ok) throw new Error('Unsplash error')
        const data = await res.json()
        const img: BannerImage = {
          url: data.urls?.regular || data.urls?.full,
          author: data.user?.name || '',
          authorUrl: data.user?.links?.html || '',
          month: currentMonth,
        }
        localStorage.setItem(cacheKey, JSON.stringify(img))
        setImage(img)
      } catch {
        setImage({
          url: FALLBACK_IMAGES[currentMonth] || FALLBACK_IMAGES[1],
          author: '',
          authorUrl: '',
          month: currentMonth,
        })
        setShowCredit(false)
      }
    })()
  }, [])

  if (!image) {
    // Skeleton
    return (
      <div style={{
        width: '100%', height: 180, borderRadius: 20,
        marginBottom: 20, overflow: 'hidden',
        background: 'linear-gradient(90deg, #E8E0D8 25%, #F0E8DC 50%, #E8E0D8 75%)',
        backgroundSize: '200% 100%',
        animation: 'novae-shimmer 1.5s infinite',
      }}>
        <style>{`@keyframes novae-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
      </div>
    )
  }

  return (
    <div style={{
      position: 'relative', width: '100%', height: 180,
      borderRadius: 20, overflow: 'hidden',
      marginBottom: 20,
      boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
    }}>
      <img
        src={image.url}
        alt={`Paysage ${config.label}`}
        onLoad={() => setLoaded(true)}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.8s ease',
          filter: 'brightness(0.82) saturate(0.88)',
        }}
      />

      {!loaded && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, #E8E0D8 25%, #F0E8DC 50%, #E8E0D8 75%)',
          backgroundSize: '200% 100%',
          animation: 'novae-shimmer 1.5s infinite',
        }} />
      )}

      {/* Overlay dégradé */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(26,26,26,0.6) 0%, rgba(26,26,26,0.1) 55%, transparent 100%)',
      }} />

      {/* Texte bas gauche */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '14px 18px',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{
            margin: 0,
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 13, fontStyle: 'italic',
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: '0.03em', lineHeight: 1.3,
          }}>
            {config.mood}
          </p>
          <p style={{
            margin: '3px 0 0',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 24, fontWeight: 600,
            color: '#FFFFFF', lineHeight: 1,
            letterSpacing: '0.02em',
          }}>
            {config.label}
          </p>
        </div>

        {/* Crédit photo discret (obligatoire Unsplash) */}
        {showCredit && image.author && (
          <a
            href={`${image.authorUrl}?utm_source=novae_app&utm_medium=referral`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 9, color: 'rgba(255,255,255,0.4)',
              textDecoration: 'none',
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: '0.04em',
            }}
          >
            📷 {image.author}
          </a>
        )}
      </div>

      <style>{`@keyframes novae-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
    </div>
  )
}

// ─────────────────────────────────────────────
// DONNÉES PAGE
// ─────────────────────────────────────────────

const modules = [
  { href: '/program',   emoji: '🎯', title: 'Programme 90j', color: '#F2E0D8', border: '#D4A090' },
  { href: '/planner',   emoji: '📅', title: 'Planner',        color: '#C8D8E8', border: '#A0BEDC' },
  { href: '/defis',     emoji: '⚡', title: 'Défis',          color: '#F0D8F0', border: '#C8A0C8' },
  { href: '/tracker',   emoji: '📊', title: 'Tracker',        color: '#CCE8D8', border: '#90C8A8' },
  { href: '/routines',  emoji: '☀️', title: 'Routines',       color: '#FBF0CC', border: '#E8D080' },
  { href: '/agent',     emoji: '🤖', title: 'Agent IA',       color: '#E8E4DF', border: '#C8C4BF' },
  { href: '/recipes',   emoji: '🛒', title: 'Recettes',       color: '#F2E0D8', border: '#D4A090' },
  { href: '/family',    emoji: '💛', title: 'Famille',        color: '#FBF0CC', border: '#E8D080' },
  { href: '/notes',     emoji: '📝', title: 'Notes',          color: '#F0E8DC', border: '#C8A882' },
  { href: '/community', emoji: '👥', title: 'Communauté',     color: '#F5D0DC', border: '#E0A0B8' },
]

const PHASE_MESSAGES: Record<string, { label: string; color: string; bg: string; message: string }> = {
  reprogrammation: {
    label: 'Phase 1 — Reprogrammation',
    color: '#7B6FA0', bg: 'rgba(123,111,160,0.1)',
    message: 'Tu construis les fondations. Chaque petit geste compte.',
  },
  action: {
    label: 'Phase 2 — Action & Discipline',
    color: '#C4956A', bg: 'rgba(196,149,106,0.1)',
    message: "Tu passes à l'action. La régularité est ta force.",
  },
  expansion: {
    label: 'Phase 3 — Expansion',
    color: '#4CAF50', bg: 'rgba(76,175,80,0.1)',
    message: 'Tu es en phase d\'expansion. Continue à viser haut.',
  },
}

const MOTIVATIONAL_MESSAGES = [
  'Chaque jour est une nouvelle chance de te rapprocher de qui tu veux être.',
  'La discipline d\'aujourd\'hui est la liberté de demain.',
  'Tu n\'as pas besoin de te motiver. Tu as besoin de commencer.',
  'Le progrès, pas la perfection.',
  'Une action simple aujourd\'hui change tout demain.',
  'Tu avances plus que tu ne le crois.',
]

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getPhase(day: number): string {
  if (day <= 30) return 'reprogrammation'
  if (day <= 60) return 'action'
  return 'expansion'
}

// ─────────────────────────────────────────────
// PAGE PRINCIPALE
// ─────────────────────────────────────────────

export default function HomePage() {
  const { user } = useSupabaseAuth()
  const router = useRouter()
  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [showModules, setShowModules] = useState(false)

  const [currentDay, setCurrentDay] = useState<number>(0)
  const [programProgress, setProgramProgress] = useState<number>(0)
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

  // Vérification onboarding
  useEffect(() => {
    if (!user || onboardingChecked) return
    const checkOnboarding = async () => {
      const { data } = await supabase
        .from('ai_personality_profile')
        .select('id')
        .eq('user_id', user.id)
        .single()
      setOnboardingChecked(true)
      if (!data) router.push('/onboarding')
    }
    checkOnboarding()
  }, [user])

  // Version tour
  useEffect(() => {
    const tourVersion = localStorage.getItem('novae-onboarding-version')
    if (tourVersion !== 'v2') {
      localStorage.removeItem('novae-onboarding-done')
      localStorage.setItem('novae-onboarding-version', 'v2')
    }
  }, [])

  // Message du jour + intention
  useEffect(() => {
    const idx = new Date().getDate() % MOTIVATIONAL_MESSAGES.length
    setDailyMessage(MOTIVATIONAL_MESSAGES[idx])

    const today = fmtDate(new Date())
    const saved = localStorage.getItem(`novae-reflection-${today}`)
    if (saved) {
      try {
        const data = JSON.parse(saved)
        setIntention(data.morningIntention || null)
      } catch {}
    }
  }, [])

  // Données dashboard
  useEffect(() => {
    if (!user) return
    loadDashboardData()
  }, [user])

  const loadDashboardData = async () => {
    if (!user) return
    const today = fmtDate(new Date())

    const [progressRes, tasksRes, routinesRes] = await Promise.all([
      supabase.from('program_progress').select('*').eq('user_id', user.id).single(),
      supabase.from('tasks').select('*').eq('user_id', user.id).gte('date', today).lte('date', today + 'T23:59:59'),
      supabase.from('routines').select('*').eq('user_id', user.id),
    ])

    if (progressRes.data) {
      const day = progressRes.data.current_day || 1
      setCurrentDay(day)
      setProgramProgress(Math.round((day / 90) * 100))
      setStreak(progressRes.data.streak || 0)
    }

    const tasks = tasksRes.data || []
    setTodayTasks(tasks)
    setTodayTasksDone(tasks.filter((t: any) => t.status === 'completed').length)

    const routines = routinesRes.data || []
    setRoutinesTotal(routines.length)
    setRoutinesDone(routines.filter((r: any) => r.completed).length)

    try {
      const lastVisit = localStorage.getItem('novae-community-last-visit')
      const since = lastVisit || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('community_posts')
        .select('*', { count: 'exact', head: true })
        .gt('created_at', since)
      setNewCommunityPosts(count || 0)
    } catch {}
  }

  const restartTour = () => {
    localStorage.removeItem('novae-onboarding-done')
    setShowTour(true)
    window.dispatchEvent(new CustomEvent('novae-restart-tour'))
  }

  const phase = getPhase(currentDay)
  const phaseInfo = PHASE_MESSAGES[phase]
  const progressPercent = programProgress

  return (
    <>
      <OnboardingTour forceShow={showTour} onClose={() => setShowTour(false)} />
      <div style={{ minHeight: '100vh', background: '#FAF7F2', fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── TOP BAR ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px', background: '#FFFFFF',
          borderBottom: '1px solid #E8E4DF',
          position: 'sticky', top: 0, zIndex: 30,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: '#D4A090' }}>
              Novae
            </span>
            {currentDay > 0 && (
              <span style={{
                fontSize: 11, color: '#C4956A',
                background: 'rgba(196,149,106,0.1)',
                padding: '2px 10px', borderRadius: 20, fontWeight: 500,
              }}>
                Jour {currentDay}/90
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {newCommunityPosts > 0 && (
              <Link
                href="/community"
                onClick={() => localStorage.setItem('novae-community-last-visit', new Date().toISOString())}
                style={{
                  textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5,
                  background: '#F5D0DC', border: '1px solid #E0A0B8',
                  borderRadius: 20, padding: '4px 10px',
                }}
              >
                <span style={{ fontSize: 13 }}>💬</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#D4856A' }}>
                  {newCommunityPosts} message{newCommunityPosts > 1 ? 's' : ''}
                </span>
              </Link>
            )}
            {user ? <UserMenu /> : (
              <Link href="/auth" style={{
                padding: '8px 20px', borderRadius: 20,
                border: '1.5px solid #D4A090', background: '#FFFFFF',
                color: '#D4A090', textDecoration: 'none',
                fontSize: 13, fontWeight: 600,
              }}>
                Se connecter
              </Link>
            )}
          </div>
        </div>

        <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px 120px' }}>

          {/* ── HERO DU JOUR ── */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: '#6B6B6B', margin: '0 0 4px' }}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 34, fontWeight: 600,
              color: '#1A1A1A', margin: '0 0 6px', lineHeight: 1.15,
            }}>
              {greeting}{pseudo ? `, ${pseudo}` : ''} 👋
            </h1>
            {currentDay > 0 && (
              <p style={{ fontSize: 14, color: '#6B6B6B', margin: 0, fontStyle: 'italic' }}>
                {dailyMessage}
              </p>
            )}
          </div>

          {/* ── BANNIÈRE SAISONNIÈRE ── */}
          <HomeAestheticBanner />

          {/* ── CARTE PROGRAMME ── */}
          {user && currentDay > 0 && (
            <Link href="/program" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
              <div style={{
                background: 'linear-gradient(135deg, #1A1A1A 0%, #2C2C2C 100%)',
                borderRadius: 20, padding: '24px',
                position: 'relative', overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(26,26,26,0.15)',
              }}>
                <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(196,149,106,0.12)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(196,149,106,0.06)', pointerEvents: 'none' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 4 }}>
                      {phaseInfo.label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 52, fontWeight: 600, color: '#FFFFFF', lineHeight: 1 }}>{currentDay}</span>
                      <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.4)', fontWeight: 300 }}>/90</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {streak > 0 && (
                      <div style={{ background: 'rgba(255,165,0,0.15)', border: '1px solid rgba(255,165,0,0.3)', borderRadius: 10, padding: '6px 12px', marginBottom: 8 }}>
                        <span style={{ fontSize: 14 }}>🔥</span>
                        <span style={{ fontSize: 12, color: '#FFA500', fontWeight: 600, marginLeft: 4 }}>{streak} jours</span>
                      </div>
                    )}
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{progressPercent}% accompli</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 4, height: 4, marginBottom: 14, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progressPercent}%`, background: 'linear-gradient(90deg, #C4956A, #E8B48A)', borderRadius: 4, transition: 'width 1s ease' }} />
                </div>

                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '0 0 16px', lineHeight: 1.5 }}>
                  {phaseInfo.message}
                </p>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#C4956A', borderRadius: 10, padding: '10px 18px' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Voir ma mission du jour</span>
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>→</span>
                </div>
              </div>
            </Link>
          )}

          {/* ── 3 ACTIONS DU JOUR ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            <Link href="/planner" style={{ textDecoration: 'none' }}>
              <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '14px 12px', border: '1.5px solid #E8E4DF', textAlign: 'center' }}>
                <span style={{ fontSize: 22, display: 'block', marginBottom: 6 }}>📋</span>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', fontFamily: "'Cormorant Garamond', serif", lineHeight: 1 }}>
                  {todayTasksDone}/{todayTasks.length || 0}
                </div>
                <div style={{ fontSize: 10, color: '#6B6B6B', marginTop: 3, fontWeight: 500 }}>tâches</div>
                {todayTasks.length > 0 && todayTasksDone === todayTasks.length && (
                  <div style={{ fontSize: 10, color: '#4CAF50', marginTop: 4, fontWeight: 600 }}>✓ Tout fait !</div>
                )}
              </div>
            </Link>

            <Link href="/routines" style={{ textDecoration: 'none' }}>
              <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '14px 12px', border: '1.5px solid #E8E4DF', textAlign: 'center' }}>
                <span style={{ fontSize: 22, display: 'block', marginBottom: 6 }}>☀️</span>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', fontFamily: "'Cormorant Garamond', serif", lineHeight: 1 }}>
                  {routinesDone}/{routinesTotal || 0}
                </div>
                <div style={{ fontSize: 10, color: '#6B6B6B', marginTop: 3, fontWeight: 500 }}>routines</div>
                {routinesTotal > 0 && routinesDone === routinesTotal && (
                  <div style={{ fontSize: 10, color: '#4CAF50', marginTop: 4, fontWeight: 600 }}>✓ Parfait !</div>
                )}
              </div>
            </Link>

            <Link href="/agent" style={{ textDecoration: 'none' }}>
              <div style={{ background: 'linear-gradient(135deg, rgba(196,149,106,0.1), rgba(212,133,106,0.15))', borderRadius: 14, padding: '14px 12px', border: '1.5px solid rgba(196,149,106,0.3)', textAlign: 'center' }}>
                <span style={{ fontSize: 22, display: 'block', marginBottom: 6 }}>🤖</span>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#C4956A', lineHeight: 1.2 }}>Agent</div>
                <div style={{ fontSize: 10, color: '#6B6B6B', marginTop: 3, fontWeight: 500 }}>NOVAÉ</div>
                <div style={{ fontSize: 9, color: '#C4956A', marginTop: 4, fontWeight: 600 }}>● Connecté</div>
              </div>
            </Link>
          </div>

          {/* ── INTENTION DU JOUR ── */}
          {intention ? (
            <div style={{ background: 'white', border: '1.5px solid rgba(196,149,106,0.2)', borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>✨</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#C4956A', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 3px' }}>Mon intention</p>
                <p style={{ fontSize: 15, color: '#1A1A1A', fontStyle: 'italic', margin: 0, fontFamily: "'Cormorant Garamond', serif" }}>"{intention}"</p>
              </div>
              <Link href="/routines" style={{ fontSize: 11, color: '#C4956A', textDecoration: 'none', flexShrink: 0 }}>Modifier →</Link>
            </div>
          ) : (
            <Link href="/routines" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
              <div style={{ background: 'rgba(196,149,106,0.05)', border: '1.5px dashed rgba(196,149,106,0.3)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>✨</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#C4956A', margin: '0 0 2px' }}>Définir mon intention du jour</p>
                  <p style={{ fontSize: 11, color: '#6B6B6B', margin: 0 }}>Commence avec clarté et focus</p>
                </div>
                <span style={{ color: '#C4956A', fontSize: 16 }}>→</span>
              </div>
            </Link>
          )}

          {/* ── BOUTON COMMENCER MA JOURNÉE ── */}
          <Link href="/program" style={{ textDecoration: 'none', display: 'block', marginBottom: 20 }}>
            <div style={{ background: '#C4956A', borderRadius: 14, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 16px rgba(196,149,106,0.3)', cursor: 'pointer' }}>
              <span style={{ fontSize: 16 }}>🎯</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'white', letterSpacing: '0.02em' }}>Commencer ma journée</span>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>→</span>
            </div>
          </Link>

          {/* ── BANDEAU COMMUNAUTÉ ── */}
          {newCommunityPosts > 0 && (
            <Link
              href="/community"
              style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}
              onClick={() => localStorage.setItem('novae-community-last-visit', new Date().toISOString())}
            >
              <div style={{ background: 'linear-gradient(135deg, #F5D0DC, #FCE8EE)', border: '1.5px solid #E0A0B8', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: '#E0A0B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>💬</div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>Communauté NOVAÉ</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B6B6B' }}>
                    {newCommunityPosts} nouveau{newCommunityPosts > 1 ? 'x' : ''} message{newCommunityPosts > 1 ? 's' : ''} depuis ta dernière visite
                  </p>
                </div>
                <div style={{ background: '#D4856A', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {newCommunityPosts}
                </div>
                <span style={{ color: '#C4956A', fontSize: 16 }}>→</span>
              </div>
            </Link>
          )}

          {/* ── SÉPARATEUR MODULES ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: '#E8E4DF' }} />
            <button
              onClick={() => setShowModules(!showModules)}
              style={{ fontSize: 11, color: '#6B6B6B', background: 'none', border: '1px solid #E8E4DF', borderRadius: 20, padding: '5px 14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
            >
              {showModules ? '▲' : '▼'} Tous les modules
            </button>
            <div style={{ flex: 1, height: 1, background: '#E8E4DF' }} />
          </div>

          {/* ── MODULES ── */}
          {showModules && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
              {modules.map((mod) => (
                <Link key={mod.href} href={mod.href} style={{ textDecoration: 'none' }}>
                  <div style={{ background: mod.color, border: `1.5px solid ${mod.border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{mod.emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A' }}>{mod.title}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

        </main>

        {/* ── BOUTONS FIXES ── */}
        <div style={{ position: 'fixed', bottom: 70, right: 16, zIndex: 50, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={restartTour}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 20, background: '#FFFFFF', border: '1px solid #E8E4DF', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', fontSize: 11, color: '#6B6B6B', cursor: 'pointer' }}
          >
            🎓 Tuto
          </button>
          <Link href="/settings" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 20, background: '#FFFFFF', border: '1px solid #E8E4DF', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', textDecoration: 'none', fontSize: 11, color: '#6B6B6B' }}>
            ⚙️
          </Link>
        </div>

        {/* ── BOTTOM NAV MOBILE ── */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#FFFFFF', borderTop: '1px solid #E8E4DF', display: 'flex', overflowX: 'auto', padding: '6px 8px', gap: 2, zIndex: 40 }} className="md:hidden">
          {modules.slice(0, 6).map(mod => (
            <Link key={mod.href} href={mod.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 8px', borderRadius: 10, textDecoration: 'none', minWidth: 52, flexShrink: 0 }}>
              <span style={{ fontSize: 18 }}>{mod.emoji}</span>
              <span style={{ fontSize: 9, color: '#6B6B6B', marginTop: 2 }}>{mod.title.split(' ')[0]}</span>
            </Link>
          ))}
          <button
            onClick={() => setShowModules(true)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 8px', borderRadius: 10, border: 'none', background: 'none', cursor: 'pointer', minWidth: 52, flexShrink: 0 }}
          >
            <span style={{ fontSize: 18 }}>⋯</span>
            <span style={{ fontSize: 9, color: '#6B6B6B', marginTop: 2 }}>Plus</span>
          </button>
        </div>

      </div>
    </>
  )
}