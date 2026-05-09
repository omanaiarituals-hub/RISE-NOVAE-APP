'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useProgramProgress } from '@/hooks/useProgramProgress'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { AuthGuard } from '@/components/AuthGuard'
import missionsData from '@/data/missions.json'
import { supabase } from '@/lib/supabase/client'
import { DemoBanner } from '@/components/DemoBanner'

// ── Images par thème ────────────────────────────────────────────
// Paysages du monde + thèmes pour varier chaque jour
const DAY_IMAGES: Record<number, string> = {
  1:  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=75',  // lac montagne
  2:  'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=75',  // collines vertes
  3:  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=75',  // forêt lumière
  4:  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&q=75',  // brume montagne
  5:  'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=600&q=75',  // ocean vagues
  6:  'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&q=75',  // carnet bureau
  7:  'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=600&q=75',  // montagne neige
  8:  'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=600&q=75',  // agenda stylo
  9:  'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&q=75',  // coucher soleil mer
  10: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&q=75',  // yoga plage
  11: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=75',  // amies café
  12: 'https://images.unsplash.com/photo-1512273222628-4daea6e55abb?w=600&q=75',  // fleurs japon
  13: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=75',     // finances
  14: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=75',  // bureau minimaliste
  15: 'https://images.unsplash.com/photo-1455541504462-57ebb2a9cec1?w=600&q=75',  // désert dunes
  16: 'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=600&q=75',  // miroir reflet
  17: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600&q=75',  // méditation silence
  18: 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=600&q=75',  // femme lumière
  19: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=600&q=75',     // téléphone minimal
  20: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=600&q=75',  // arbres automne
  21: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=600&q=75',     // dressing rangé
  22: 'https://images.unsplash.com/photo-1477346611705-65d1883cee1e?w=600&q=75',  // lever soleil lac
  23: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=75',  // montagne nuit étoiles
  24: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=75',  // falaise ocean
  25: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=600&q=75',  // route forêt
  26: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=75',  // plage turquoise
  27: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=75',  // nutrition saine
  28: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=600&q=75',  // coin lecture cosy
  29: 'https://images.unsplash.com/photo-1458668383970-8ddd3927deed?w=600&q=75',  // alpes suisses
  30: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&q=75',  // forêt dorée
  // Phase 2 — J31–J60
  31: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&q=75',
  32: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=600&q=75',
  33: 'https://images.unsplash.com/photo-1526779259212-939e64788e3c?w=600&q=75',
  34: 'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=600&q=75',
  35: 'https://images.unsplash.com/photo-1431440869543-efaf3388c585?w=600&q=75',
  36: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=600&q=75',
  37: 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=600&q=75',
  38: 'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=600&q=75',
  39: 'https://images.unsplash.com/photo-1548345680-f5475ea5df84?w=600&q=75',
  40: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&q=75',
  41: 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=600&q=75',
  42: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=75',
  43: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=75',
  44: 'https://images.unsplash.com/photo-1455541504462-57ebb2a9cec1?w=600&q=75',
  45: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=75',
  46: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=75',
  47: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=600&q=75',
  48: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=75',
  49: 'https://images.unsplash.com/photo-1458668383970-8ddd3927deed?w=600&q=75',
  50: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&q=75',
  51: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=75',
  52: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&q=75',
  53: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=600&q=75',
  54: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&q=75',
  55: 'https://images.unsplash.com/photo-1512273222628-4daea6e55abb?w=600&q=75',
  56: 'https://images.unsplash.com/photo-1477346611705-65d1883cee1e?w=600&q=75',
  57: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=600&q=75',
  58: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=600&q=75',
  59: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600&q=75',
  60: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=75',
  // Phase 3 — J61–J90
  61: 'https://images.unsplash.com/photo-1431440869543-efaf3388c585?w=600&q=75',
  62: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=600&q=75',
  63: 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=600&q=75',
  64: 'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=600&q=75',
  65: 'https://images.unsplash.com/photo-1548345680-f5475ea5df84?w=600&q=75',
  66: 'https://images.unsplash.com/photo-1526779259212-939e64788e3c?w=600&q=75',
  67: 'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=600&q=75',
  68: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&q=75',
  69: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=600&q=75',
  70: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=600&q=75',
  71: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=75',
  72: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=75',
  73: 'https://images.unsplash.com/photo-1455541504462-57ebb2a9cec1?w=600&q=75',
  74: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=75',
  75: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=75',
  76: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=600&q=75',
  77: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=75',
  78: 'https://images.unsplash.com/photo-1458668383970-8ddd3927deed?w=600&q=75',
  79: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&q=75',
  80: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&q=75',
  81: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=600&q=75',
  82: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&q=75',
  83: 'https://images.unsplash.com/photo-1512273222628-4daea6e55abb?w=600&q=75',
  84: 'https://images.unsplash.com/photo-1477346611705-65d1883cee1e?w=600&q=75',
  85: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=600&q=75',
  86: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=600&q=75',
  87: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600&q=75',
  88: 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=600&q=75',
  89: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=75',
  90: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=75',
}

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=75'

const PHASE_META = [
  { num: 1, label: 'Reprogrammation',    days: 'J1 — J30',  color: '#C4956A', bg: '#1A1A1A', image: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800&q=75' },
  { num: 2, label: 'Action & Discipline', days: 'J31 — J60', color: '#7CB87A', bg: '#1D2E28', image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=75' },
  { num: 3, label: 'Expansion',           days: 'J61 — J90', color: '#9B8EC4', bg: '#1E1830', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=75' },
]

export default function ProgramPage() {
  const { user, loading: authLoading } = useSupabaseAuth()
  const router = useRouter()
const { currentDay, isLoaded, refreshProgress } = useProgramProgress()
  const [activePhase, setActivePhase] = useState(1)
  const [completedDays, setCompletedDays] = useState<number[]>([])
  const [phaseLetters, setPhaseLetters] = useState<{ phase: number; read_at: string | null }[]>([])
  const [expandedDay, setExpandedDay] = useState<number | null>(null)
  const [reflections, setReflections] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState<number | null>(null)

  // Sync phase avec le jour courant
  useEffect(() => {
    if (!isLoaded) return
    if (currentDay <= 30) setActivePhase(1)
    else if (currentDay <= 60) setActivePhase(2)
    else setActivePhase(3)
  }, [currentDay, isLoaded])

  useEffect(() => {
    if (user) loadProgress()
  }, [user])

  useEffect(() => {
  refreshProgress()
}, [])

  const loadProgress = async () => {
    if (!user) return
    const { data } = await supabase
      .from('mission_responses')
      .select('day_number, reflection')
      .eq('user_id', user.id)
    if (data) {
      setCompletedDays(data.map(d => d.day_number))
      const refMap: Record<number, string> = {}
      data.forEach(d => { if (d.reflection) refMap[d.day_number] = d.reflection })
      setReflections(refMap)
    }
    const { data: lettersData } = await supabase
      .from('phase_letters')
      .select('phase, read_at')
      .eq('user_id', user.id)
    setPhaseLetters((lettersData as any[]) || [])
  }

  const getMissionsForPhase = (phase: number) => {
    const start = (phase - 1) * 30 + 1
    const end = phase * 30
    return (missionsData as any[]).filter(m => m.day >= start && m.day <= end)
  }

  const saveReflection = async (day: number, text: string) => {
    if (!user || !text.trim()) return
    setSaving(day)
    try {
      await supabase.from('mission_responses').upsert({
        user_id: user.id,
        day_number: day,
        reflection: text.trim(),
        completed_at: new Date().toISOString()
      }, { onConflict: 'user_id,day_number' })
      setCompletedDays(prev => prev.includes(day) ? prev : [...prev, day])
      setReflections(prev => ({ ...prev, [day]: text.trim() }))
      setExpandedDay(null)
    } finally {
      setSaving(null)
    }
  }

  const goToDay = (day: number) => {
    router.push(`/program/${day}`)
  }

  if (authLoading || !isLoaded) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDFAF7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(26,26,26,0.3)', fontSize: 14 }}>Chargement...</p>
      </div>
    )
  }

  const phaseMeta = PHASE_META[activePhase - 1]
  const missions = getMissionsForPhase(activePhase)
  const phaseCompleted = completedDays.filter(d => {
    const start = (activePhase - 1) * 30 + 1
    return d >= start && d <= start + 29
  }).length

  const currentPhasNum = currentDay <= 30 ? 1 : currentDay <= 60 ? 2 : 3
  const todayMission = missions.find(m => m.day === currentDay)

  return (
    <AuthGuard>
      <>
        <DemoBanner />
        <div style={{ minHeight: '100vh', background: '#FDFAF7', fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── HEADER PHASE avec image ── */}
        <div style={{ position: 'relative', height: 220, overflow: 'hidden' }}>
          <img
            src={phaseMeta.image}
            alt={phaseMeta.label}
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.65) saturate(0.8)' }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, ${phaseMeta.bg}ee 100%)`
          }} />

          <Link href="/" style={{
            position: 'absolute', top: 52, left: 20,
            color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 22, lineHeight: 1
          }}>←</Link>

          <div style={{ position: 'absolute', bottom: 24, left: 20, right: 20 }}>
            <div style={{
              display: 'inline-block', fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase',
              color: phaseMeta.color, fontWeight: 700,
              background: `${phaseMeta.color}22`, padding: '4px 10px', borderRadius: 20,
              border: `1px solid ${phaseMeta.color}44`, marginBottom: 8
            }}>
              Phase {phaseMeta.num} · {phaseMeta.days}
            </div>
            <h1 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 30, fontWeight: 500, color: 'white', margin: '0 0 10px', letterSpacing: '0.02em'
            }}>
              {phaseMeta.label}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 2 }}>
                <div style={{
                  width: `${(phaseCompleted / 30) * 100}%`, height: '100%',
                  background: phaseMeta.color, borderRadius: 2, transition: 'width 0.6s ease'
                }} />
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
                {phaseCompleted}/30 jours
              </span>
            </div>
          </div>
        </div>

        {/* ── SÉLECTEUR DE PHASE ── */}
        <div style={{
          display: 'flex', gap: 8, padding: '16px 20px 12px',
          background: 'white', borderBottom: '1px solid rgba(196,149,106,0.1)'
        }}>
          {PHASE_META.map(p => (
            <button key={p.num} onClick={() => setActivePhase(p.num)}
              style={{
                flex: 1, padding: '8px 4px',
                background: activePhase === p.num ? p.bg : 'transparent',
                border: `1px solid ${activePhase === p.num ? p.color : 'rgba(26,26,26,0.1)'}`,
                borderRadius: 10,
                color: activePhase === p.num ? p.color : 'rgba(26,26,26,0.4)',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                fontFamily: "'DM Sans', sans-serif"
              }}>
              P{p.num}
            </button>
          ))}
        </div>

        <div style={{ padding: '16px 20px 100px' }}>

          {/* ── BANNIÈRES LETTRES DE FIN DE PHASE ── */}
          {[1, 2, 3].map(phaseNum => {
            const requiredDay = phaseNum * 30
            if (currentDay < requiredDay) return null
            const meta = PHASE_META[phaseNum - 1]
            const letterRow = phaseLetters.find(l => l.phase === phaseNum)
            const isUnread = !letterRow?.read_at
            const isFinal = phaseNum === 3
            return (
              <Link
                key={`letter-${phaseNum}`}
                href={`/program/lettre/${phaseNum}`}
                style={{
                  display: 'block', textDecoration: 'none', marginBottom: 14,
                  padding: '18px 20px', borderRadius: 16,
                  background: `linear-gradient(135deg, ${meta.color}22, ${meta.color}10)`,
                  border: `1.5px solid ${meta.color}55`,
                  boxShadow: isUnread ? `0 0 24px ${meta.color}44` : `0 2px 12px ${meta.color}11`,
                  position: 'relative',
                }}
              >
                {isUnread && (
                  <span style={{
                    position: 'absolute', top: 8, right: 8,
                    background: meta.color, color: 'white',
                    fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}>
                    Nouveau
                  </span>
                )}
                <p style={{
                  fontSize: 9, color: meta.color, letterSpacing: '0.25em',
                  textTransform: 'uppercase', fontWeight: 700, margin: '0 0 6px'
                }}>
                  ✦ Lettre de fin de phase {phaseNum}{isFinal ? ' — Finale' : ''}
                </p>
                <p style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 18, color: '#1A1A1A', fontWeight: 500, margin: '0 0 6px'
                }}>
                  {meta.label}
                </p>
                <p style={{ fontSize: 12, color: 'rgba(26,26,26,0.55)', margin: 0 }}>
                  {isUnread ? 'NOVAÉ a écrit une lettre rien que pour toi →' : 'Relire ta lettre →'}
                </p>
              </Link>
            )
          })}

          {/* ── CARTE JOUR COURANT (si même phase) ── */}
          {activePhase === currentPhasNum && todayMission && (
            <div style={{
              borderRadius: 20, overflow: 'hidden',
              border: `1px solid ${phaseMeta.color}44`,
              marginBottom: 20,
              boxShadow: `0 4px 24px ${phaseMeta.color}22`
            }}>
              <div style={{ position: 'relative', height: 150, overflow: 'hidden' }}>
                <img
                  src={DAY_IMAGES[currentDay] || DEFAULT_IMAGE}
                  alt={todayMission.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.75)' }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,0,0,0.35) 0%, transparent 60%)' }} />
                <div style={{
                  position: 'absolute', top: 12, left: 12,
                  background: phaseMeta.color, borderRadius: 20, padding: '3px 10px',
                  fontSize: 10, fontWeight: 700, color: 'white', letterSpacing: '0.1em'
                }}>
                  AUJOURD'HUI · JOUR {currentDay}
                </div>
              </div>
              <div style={{ padding: '16px 18px', background: phaseMeta.bg }}>
                <h3 style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 22, fontWeight: 500, color: 'white', margin: '0 0 8px'
                }}>
                  {todayMission.title}
                </h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '0 0 14px', lineHeight: 1.5 }}>
                  {todayMission.guide || todayMission.description}
                </p>
                {/* Bouton qui navigue vers la page du jour */}
                <button
                  onClick={() => goToDay(currentDay)}
                  style={{
                    padding: '10px 20px',
                    background: phaseMeta.color, border: 'none', borderRadius: 10,
                    color: 'white', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif"
                  }}>
                  {completedDays.includes(currentDay) ? '✓ Revoir la mission' : 'Commencer la mission →'}
                </button>
              </div>
            </div>
          )}

          {/* ── LISTE DES 30 JOURS ── */}
          <p style={{
            fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'rgba(26,26,26,0.3)', fontWeight: 600, margin: '0 0 12px'
          }}>
            Les 30 jours de la phase
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {missions.map(mission => {
              const isDone = completedDays.includes(mission.day)
              const isToday = mission.day === currentDay
              const isExpanded = expandedDay === mission.day
              const isFuture = mission.day > currentDay

              if (isToday && activePhase === currentPhasNum) return null // déjà affiché en haut

              return (
                    <div key={mission.day} style={{
                  borderRadius: 14,
                  border: `1px solid ${isDone ? 'rgba(76,175,80,0.2)' : 'rgba(196,149,106,0.12)'}`,
                  background: isDone ? 'rgba(76,175,80,0.04)' : 'white',
                  overflow: 'hidden',
                  opacity: isFuture ? 0.55 : 1,
                  transition: 'all 0.2s'
                }}>
                  <div
                    onClick={() => !isFuture && setExpandedDay(isExpanded ? null : mission.day)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px',
                      cursor: isFuture ? 'default' : 'pointer'
                    }}
                  >
                    {/* Miniature image */}
                    <div style={{ width: 46, height: 46, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                      <img
                        src={DAY_IMAGES[mission.day] || DEFAULT_IMAGE}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isDone ? 'grayscale(0.4)' : 'none' }}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: 'rgba(26,26,26,0.3)', fontWeight: 700 }}>J{mission.day}</span>
                        {isDone && <span style={{ fontSize: 10, color: '#4CAF50', fontWeight: 700 }}>✓</span>}
                        {isFuture && <span style={{ fontSize: 11 }}>🔒</span>}
                      </div>
                      <p style={{
                        margin: 0,
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: 15, fontWeight: 500,
                        color: isFuture ? 'rgba(26,26,26,0.3)' : '#1A1A1A',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}>
                        {mission.title}
                      </p>
                    </div>

                    {!isFuture && (
                      <span style={{
                        color: 'rgba(26,26,26,0.25)', fontSize: 20, flexShrink: 0,
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s', display: 'inline-block'
                      }}>›</span>
                    )}
                  </div>

                  {/* Contenu expandé */}
                  {isExpanded && !isFuture && (
                    <div style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(196,149,106,0.08)' }}>
                      <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.6)', lineHeight: 1.6, margin: '12px 0 12px' }}>
                        {mission.guide || mission.description}
                      </p>
                      {/* Bouton naviguer vers la page complète du jour */}
                      <button
                        onClick={() => goToDay(mission.day)}
                        style={{
                          width: '100%', padding: '10px',
                          background: phaseMeta.color, border: 'none', borderRadius: 10,
                          color: 'white', fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                          marginBottom: 10
                        }}>
                        {isDone ? '✓ Revoir ce jour' : 'Aller à ce jour →'}
                      </button>
                      {/* Réflexion rapide inline */}
                      <p style={{ fontSize: 11, color: 'rgba(26,26,26,0.4)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.06em' }}>
                        RÉFLEXION RAPIDE
                      </p>
                      <textarea
                        value={reflections[mission.day] || ''}
                        onChange={e => setReflections(prev => ({ ...prev, [mission.day]: e.target.value }))}
                        placeholder={mission.question || "Ta réflexion du jour..."}
                        rows={3}
                        style={{
                          width: '100%', background: 'rgba(26,26,26,0.03)',
                          border: '1px solid rgba(196,149,106,0.2)',
                          borderRadius: 10, padding: '10px 12px',
                          fontSize: 13, color: '#1A1A1A',
                          fontFamily: "'DM Sans', sans-serif",
                          resize: 'none', outline: 'none',
                          boxSizing: 'border-box' as const
                        }}
                      />
                      <button
                        onClick={() => saveReflection(mission.day, reflections[mission.day] || '')}
                        disabled={saving === mission.day || !reflections[mission.day]?.trim()}
                        style={{
                          marginTop: 8, width: '100%', padding: '10px',
                          background: reflections[mission.day]?.trim() ? '#6B8F71' : 'rgba(26,26,26,0.08)',
                          border: 'none', borderRadius: 10,
                          color: reflections[mission.day]?.trim() ? 'white' : 'rgba(26,26,26,0.3)',
                          fontSize: 13, fontWeight: 600,
                          cursor: reflections[mission.day]?.trim() ? 'pointer' : 'not-allowed',
                          fontFamily: "'DM Sans', sans-serif"
                        }}>
                        {saving === mission.day ? 'Enregistrement...' : isDone ? '✓ Mettre à jour' : 'Sauvegarder'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      </>
    </AuthGuard>
  )
}