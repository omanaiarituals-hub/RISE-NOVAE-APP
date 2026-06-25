// src/app/HomePageClient.tsx
// REFONTE ACCUEIL v3 — layout rectangle tall à gauche, tuiles texte seul, pas d'icônes modules.
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
import StreakFlame from '@/components/StreakFlame'
import { logEvent } from '@/lib/events'

const ADMIN_EMAILS = ['nesserinesediri@gmail.com', 'omanaiarituals@gmail.com']
const TESTER_EMAILS = ['nesserinesediri@gmail.com']

type ModuleItem = { href: string; title: string; badge?: string; tester?: boolean }
type Univers = {
  key: string; title: string; subtitle: string; icon: string
  tint: string; border: string; ink: string; tileBg: string; modules: ModuleItem[]
}

const UNIVERS_LIST: Univers[] = [
  {
    key: 'quotidien', title: 'Mon quotidien', subtitle: 'Organise tes journées avec sérénité.',
    icon: '/icons/icon-quotidien.png',
    tint: 'rgba(197,211,180,0.25)', border: 'rgba(167,189,144,0.40)', ink: '#5C7044',
    tileBg: 'rgba(197,211,180,0.35)',
    modules: [
      { href: '/planner', title: 'Planner' },
      { href: '/routines', title: 'Routines' },
      { href: '/recipes', title: 'Repas' },
      { href: '/notes', title: 'Notes' },
    ],
  },
  {
    key: 'transformation', title: 'Ma transformation', subtitle: "Change ta vie un pas après l'autre.",
    icon: '/icons/icon-transformation.png',
    tint: 'rgba(242,194,182,0.25)', border: 'rgba(223,160,143,0.40)', ink: '#B5654A',
    tileBg: 'rgba(242,194,182,0.40)',
    modules: [
      { href: '/program', title: 'Reset 90j' },
      { href: '/parcours-profonds/reclaim-myself', title: 'Reclaim', badge: 'TEST', tester: true },
      { href: '/defis', title: 'Défis' },
    ],
  },
  {
    key: 'equilibre', title: 'Mon équilibre', subtitle: 'Observe, ajuste et prends soin de toi.',
    icon: '/icons/icon-equilibre.png',
    tint: 'rgba(212,196,226,0.25)', border: 'rgba(185,162,212,0.40)', ink: '#7E63A8',
    tileBg: 'rgba(212,196,226,0.40)',
    modules: [
      { href: '/tracker', title: 'Tracker' },
      { href: '/family', title: 'Famille' },
      { href: '/community', title: 'Commu.' },
    ],
  },
  {
    key: 'accompagnement', title: 'Mon accompagnement', subtitle: "Tu n'avances jamais seule.",
    icon: '/icons/icon-accompagnement.png',
    tint: 'rgba(245,216,155,0.25)', border: 'rgba(231,192,111,0.40)', ink: '#A8852E',
    tileBg: 'rgba(245,216,155,0.45)',
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
    loadData()
    checkNovaPending()
    logEvent(supabase, user.id, 'module_programme')
  }, [user, loading])

  const checkNovaPending = async () => {
    if (!user) return
    try {
      const { data } = await supabase.from('nova_pending_messages').select('thread_id')
        .eq('user_id', user.id).eq('is_read', false).limit(1)
      if (data && data.length > 0) setNovaPending({ thread_id: data[0].thread_id })
    } catch {}
  }

  const loadData = async () => {
    if (!user) return
    try {
      const { data: prog } = await supabase.from('program_progress').select('current_day').eq('user_id', user.id).maybeSingle()
      if (prog) { const d = prog.current_day || 1; setCurrentDay(d); setProgramProgress(Math.round((d / 90) * 100)) }
    } catch {}
    detectStruggleMode(supabase, user.id).then(setStruggle).catch(() => {})
  }

  const visibleModules = (u: Univers) => u.modules.filter(m => !m.tester || isTester)
  const phaseInfo = PHASE_MESSAGES[getPhase(currentDay)]

  return (
    <>
      <OnboardingTour forceShow={showTour} onClose={() => setShowTour(false)} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: 'radial-gradient(ellipse at 20% 0%, #F8E6DB 0%, transparent 55%),radial-gradient(ellipse at 80% 100%, #EBD7E0 0%, transparent 60%),linear-gradient(180deg, #FBF4EC 0%, #F8F1E5 55%, #F3E9DF 100%)' }} />

      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif", position: 'relative', zIndex: 2 }}>

        {/* HEADER */}
        <div style={{ flexShrink: 0, background: 'linear-gradient(180deg, rgba(240,201,208,0.97) 0%, rgba(233,186,196,0.92) 100%)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(225,170,180,0.45)', boxShadow: '0 4px 18px rgba(160,110,120,0.12)', padding: '10px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <img src="/logo.png" alt="NOVAÉ" style={{ height: 28, objectFit: 'contain', maxWidth: 100 }} />
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

          {/* BONJOUR */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 9.5, color: '#8b6f55', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 3px', fontWeight: 600 }} suppressHydrationWarning>{dateLabel}</p>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: '#3d2618', margin: 0, lineHeight: 1.1 }} suppressHydrationWarning>
              {greeting}{pseudo && (<>, <span style={{ color: '#8b5a3c', fontStyle: 'italic' }}>{pseudo}</span></>)}{' '}👋
            </h1>
            <p style={{ margin: '6px 0 0', fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontStyle: 'italic', color: '#6b5340', lineHeight: 1.4, borderLeft: '2px solid #c4956a', paddingLeft: 9 }}>« {proverbeDuJour} »</p>
          </div>

          {/* NOVA PENDING */}
          {novaPending && (
            <Link href={`/agent?nova_thread=${novaPending.thread_id}`} style={{ textDecoration: 'none', display: 'block', marginBottom: 10 }}>
              <div style={{ background: 'linear-gradient(135deg, rgba(212,196,226,0.55), rgba(138,111,176,0.18))', border: '1px solid rgba(138,111,176,0.35)', borderRadius: 14, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #D4C4E2, #8A6FB0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>N</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 8.5, fontWeight: 700, color: '#5b4b7a', margin: '0 0 1px', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Nova t'a laissé un message</p>
                  <p style={{ fontSize: 12, color: '#3d2618', margin: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>Appuie pour lire 💜</p>
                </div>
                <span style={{ color: '#8A6FB0', flexShrink: 0 }}>→</span>
              </div>
            </Link>
          )}

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

          {/* DUO FLAMME + RESET */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            <div style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.6)', borderRadius: 14, padding: '10px 12px' }}>
              <StreakFlame />
            </div>
            <Link href="/program" style={{ textDecoration: 'none' }}>
              <div style={{ height: '100%', background: 'rgba(243,205,182,0.35)', border: '1px solid rgba(230,180,147,0.45)', borderRadius: 14, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 70, boxSizing: 'border-box' }}>
                <div>
                  <div style={{ fontSize: 7.5, color: '#8b6f55', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600 }}>{phaseInfo.phase}</div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, color: '#3d2618', lineHeight: 1.15, marginTop: 2 }}>{phaseInfo.label}</div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 4 }}>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 500, color: '#3d2618', lineHeight: 1 }}>{currentDay > 0 ? currentDay : '—'}</span>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 11, color: '#a08770' }}>/ 90</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8b5a3c', fontWeight: 600 }}>{programProgress}%</span>
                  </div>
                  <div style={{ height: 3, background: 'rgba(139,90,60,0.15)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${programProgress}%`, background: 'linear-gradient(90deg, #d4a574, #c4956a)', borderRadius: 999 }} />
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* LABEL */}
          <div style={{ fontSize: 9, color: '#8b6f55', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, marginBottom: 8, paddingLeft: 2 }}>Mes univers</div>

          {/* 4 UNIVERS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {UNIVERS_LIST.map((u) => {
              const mods = visibleModules(u)
              return (
                <div key={u.key} style={{ background: u.tint, border: `1px solid ${u.border}`, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>

                  {/* RECTANGLE ILLUSTRATION GAUCHE */}
                  <div style={{ width: 72, flexShrink: 0, background: `${u.tint.replace('0.25', '0.5')}`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 6px', borderRight: `1px solid ${u.border}` }}>
                    <img
                      src={u.icon}
                      alt={u.title}
                      style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 12 }}
                      onError={(e) => {
                        // Fallback si l'image ne charge pas : affiche la première lettre
                        const el = e.currentTarget
                        el.style.display = 'none'
                        const parent = el.parentElement
                        if (parent && !parent.querySelector('.icon-fallback')) {
                          const fb = document.createElement('div')
                          fb.className = 'icon-fallback'
                          fb.style.cssText = `width:56px;height:56px;border-radius:12px;background:rgba(255,255,255,0.5);display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-size:28px;color:${u.ink};font-weight:600`
                          fb.textContent = u.title[0]
                          parent.appendChild(fb)
                        }
                      }}
                    />
                  </div>

                  {/* CONTENU DROIT */}
                  <div style={{ flex: 1, minWidth: 0, padding: '10px 10px 10px 12px' }}>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, fontWeight: 600, color: u.ink, lineHeight: 1.1, marginBottom: 2 }}>{u.title}</div>
                    <div style={{ fontSize: 9.5, color: '#6b5340', lineHeight: 1.25, marginBottom: 9 }}>{u.subtitle}</div>

                    {/* TUILES MODULES — texte seul */}
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${mods.length}, 1fr)`, gap: 5 }}>
                      {mods.map((m) => (
                        <Link key={m.href} href={m.href} style={{ textDecoration: 'none' }}>
                          <div style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.85)', borderRadius: 9, padding: '7px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, position: 'relative', minHeight: 36 }}>
                            {m.badge && (
                              <span style={{ position: 'absolute', top: 2, right: 2, fontSize: 5.5, fontWeight: 700, color: u.ink, background: 'rgba(255,255,255,0.95)', borderRadius: 999, padding: '1px 3px', letterSpacing: '0.04em' }}>{m.badge}</span>
                            )}
                            <span style={{ fontSize: 10.5, color: '#3d2618', fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>{m.title}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ADMIN */}
          {isAdmin && (
            <Link href="/admin" style={{ textDecoration: 'none', display: 'block', marginTop: 8 }}>
              <div style={{ background: 'linear-gradient(135deg, rgba(61,38,24,0.85), rgba(107,83,64,0.75))', border: '1px solid rgba(196,149,106,0.4)', borderRadius: 12, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flexShrink: 0 }}>🛡️</span>
                <div style={{ flex: 1, fontSize: 12, color: '#F3DCC6', fontWeight: 600 }}>Admin · Pilotage</div>
                <span style={{ color: '#F3DCC6', flexShrink: 0 }}>→</span>
              </div>
            </Link>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 7, alignItems: 'center', marginTop: 10 }}>
            <button onClick={() => { localStorage.removeItem('novae-onboarding-done'); setShowTour(true); window.dispatchEvent(new CustomEvent('novae-restart-tour')) }} style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 999, fontSize: 10, color: '#5c4530', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>🎓 Tuto</button>
            <Link href="/settings" style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(212,165,116,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, textDecoration: 'none' }}>⚙️</Link>
          </div>

        </div>
      </div>

      <style jsx>{`
        @keyframes micPulse {
          0%, 100% { box-shadow: 0 4px 14px rgba(176,125,90,0.45), 0 0 0 0 rgba(196,149,106,0.55); }
          50% { box-shadow: 0 4px 14px rgba(176,125,90,0.45), 0 0 0 7px rgba(196,149,106,0); }
        }
        .mic-cta { animation: micPulse 2.2s ease-in-out infinite; }
      `}</style>
    </>
  )
}