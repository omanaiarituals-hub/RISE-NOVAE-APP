'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Navigation from '@/components/Navigation'
import { Plus, Check, Sparkles, Flame, Star, Wind, ArrowLeft, Loader2, Edit2, Sun, Moon, X, Clock } from 'lucide-react'

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Routine {
  id: string
  title: string
  description: string
  category: 'morning' | 'evening'
  frequency: string
  custom_days: string
  completed: boolean
  last_completed_at: string | null
  streak_count: number
  reminder_enabled: boolean
  reminder_minutes: number
  preferred_time: string | null      // ex: "07:30"
  duration_minutes: number | null    // ex: 30
  user_id?: string
}

interface LocalReflection {
  morningIntention: string
  eveningGratitude: string
  eveningHighlight: string
  morningMood: string | null
}

interface ConflictAlert {
  routineTitle: string
  conflictTitle: string
  hour: number
}

// ─── CONSTS ───────────────────────────────────────────────────────────────────
const DAYS = [
  { key: 'mon', label: 'L' }, { key: 'tue', label: 'M' }, { key: 'wed', label: 'M' },
  { key: 'thu', label: 'J' }, { key: 'fri', label: 'V' }, { key: 'sat', label: 'S' }, { key: 'sun', label: 'D' },
]
const DAY_NAMES: Record<string, string> = { mon: 'Lun', tue: 'Mar', wed: 'Mer', thu: 'Jeu', fri: 'Ven', sat: 'Sam', sun: 'Dim' }
const TODAY_KEY = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()]
const MOODS = [
  { emoji: '🌟', label: 'Énergique' }, { emoji: '😌', label: 'Sereine' }, { emoji: '💪', label: 'Motivée' },
  { emoji: '🌿', label: 'Calme' }, { emoji: '🔥', label: 'Déterminée' }, { emoji: '💤', label: 'Fatiguée' },
]
const EMOJIS = ['✨','🎯','💆','📖','🏃','🧘','💧','🍵','📝','🌸','🌞','💫','🎵','🌙','☀️','🏆','💊','🥗']
const DURATIONS = [15, 20, 30, 45, 60, 90, 120]
const C = {
  morning: { primary: '#C4956A', bg: 'rgba(196,149,106,0.08)', light: 'rgba(196,149,106,0.18)' },
  evening: { primary: '#7B6FA0', bg: 'rgba(123,111,160,0.08)', light: 'rgba(123,111,160,0.18)' },
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function parseDays(custom_days: any): string[] {
  if (!custom_days) return ['mon','tue','wed','thu','fri','sat','sun']
  if (Array.isArray(custom_days)) return custom_days
  if (typeof custom_days !== 'string' || custom_days === '' || custom_days === 'null') return ['mon','tue','wed','thu','fri','sat','sun']
  if (custom_days.startsWith('{')) {
    return custom_days.replace(/[{}]/g, '').split(',').map((d: string) => d.trim()).filter(Boolean)
  }
  try { return JSON.parse(custom_days) } catch { return custom_days.split(',').map((d: string) => d.trim()) }
}

function isScheduledToday(routine: Routine): boolean {
  if (routine.frequency === 'daily') return true
  const days = parseDays(routine.custom_days)
  if (days.length === 0 || days.length === 7) return true
  return days.includes(TODAY_KEY)
}

function getFrequencyLabel(routine: Routine): string {
  if (routine.frequency === 'daily') return 'Chaque jour'
  const days = parseDays(routine.custom_days)
  if (days.length === 0 || days.length === 7) return 'Chaque jour'
  return days.map(d => DAY_NAMES[d]).join(', ')
}

function getTimeLabel(routine: Routine): string {
  if (!routine.preferred_time) return ''
  const dur = routine.duration_minutes ? ` · ${routine.duration_minutes}min` : ''
  return `${routine.preferred_time.slice(0,5)}${dur}`
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function RoutineModal({ initial, defaultCategory, onSave, onDelete, onClose }: {
  initial?: Routine
  defaultCategory?: 'morning' | 'evening'
  onSave: (data: Partial<Routine>) => Promise<void>
  onDelete?: (id: string) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(initial?.title || '')
  const [emoji, setEmoji] = useState(initial?.description || '✨')
  const [category, setCategory] = useState<'morning' | 'evening'>(initial?.category || defaultCategory || 'morning')
  const [selectedDays, setSelectedDays] = useState<string[]>(() => {
    if (!initial?.custom_days) return ['mon','tue','wed','thu','fri','sat','sun']
    return parseDays(initial.custom_days)
  })
  const [preferredTime, setPreferredTime] = useState(initial?.preferred_time?.slice(0,5) || '')
  const [durationMinutes, setDurationMinutes] = useState<number | null>(initial?.duration_minutes || null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [saving, setSaving] = useState(false)
  const colors = C[category]

  const toggleDay = (key: string) =>
    setSelectedDays(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key])

  const handleSave = async () => {
    if (!title.trim() || selectedDays.length === 0) return
    setSaving(true)
    await onSave({
      title: title.trim(),
      description: emoji,
      category,
      frequency: selectedDays.length === 7 ? 'daily' : 'custom',
      custom_days: '{' + selectedDays.join(',') + '}',
      preferred_time: preferredTime || null,
      duration_minutes: durationMinutes,
    })
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 600, padding: '20px 20px 40px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, background: '#E8E4DF', borderRadius: 4, margin: '0 auto 20px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: '#2C2C2C' }}>
            {initial ? 'Modifier le rituel' : 'Nouveau rituel'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}><X size={20} /></button>
        </div>

        {/* Emoji + Titre */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <button onClick={() => setShowEmoji(!showEmoji)}
            style={{ width: 52, height: 52, borderRadius: 14, border: `2px solid ${showEmoji ? colors.primary : '#E8E4DF'}`, background: '#FAF7F2', fontSize: 24, cursor: 'pointer', flexShrink: 0 }}>
            {emoji}
          </button>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nom du rituel..." autoFocus
            style={{ flex: 1, border: '1.5px solid #E8E4DF', borderRadius: 12, padding: '0 14px', fontSize: 15, outline: 'none', color: '#2C2C2C', background: '#FAF7F2', fontFamily: "'DM Sans',sans-serif" }} />
        </div>

        {showEmoji && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14, padding: 10, background: '#FAF7F2', borderRadius: 12 }}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => { setEmoji(e); setShowEmoji(false) }}
                style={{ fontSize: 22, width: 38, height: 38, borderRadius: 10, border: 'none', background: emoji === e ? colors.bg : 'transparent', cursor: 'pointer' }}>
                {e}
              </button>
            ))}
          </div>
        )}

        {/* Catégorie */}
        <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Moment</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {(['morning', 'evening'] as const).map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: `2px solid ${category === cat ? C[cat].primary : '#E8E4DF'}`, background: category === cat ? C[cat].bg : 'white', cursor: 'pointer', fontSize: 13, fontWeight: category === cat ? 700 : 400, color: category === cat ? C[cat].primary : '#666' }}>
              {cat === 'morning' ? '☀️ Matin' : '🌙 Soir'}
            </button>
          ))}
        </div>

        {/* Jours */}
        <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Récurrence</p>
        <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
          {DAYS.map(d => (
            <button key={d.key} onClick={() => toggleDay(d.key)}
              style={{ flex: 1, height: 38, borderRadius: 10, border: `2px solid ${selectedDays.includes(d.key) ? colors.primary : '#E8E4DF'}`, background: selectedDays.includes(d.key) ? colors.bg : 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: selectedDays.includes(d.key) ? colors.primary : '#bbb' }}>
              {d.label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#bbb', margin: '0 0 18px' }}>
          {selectedDays.length === 7 ? 'Tous les jours' : selectedDays.length === 0 ? 'Sélectionne au moins un jour' : selectedDays.map(d => DAY_NAMES[d]).join(' · ')}
        </p>

        {/* Heure + Durée */}
        <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>
          Heure & durée <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(optionnel — apparaît dans le Planner)</span>
        </p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 4 }}>Heure de début</label>
            <div style={{ position: 'relative' }}>
              <Clock size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: preferredTime ? colors.primary : '#bbb' }} />
              <input
                type="time"
                value={preferredTime}
                onChange={e => setPreferredTime(e.target.value)}
                style={{ width: '100%', border: `1.5px solid ${preferredTime ? colors.primary : '#E8E4DF'}`, borderRadius: 10, padding: '9px 10px 9px 30px', fontSize: 14, outline: 'none', color: '#2C2C2C', background: preferredTime ? colors.bg : '#FAF7F2', boxSizing: 'border-box' as const }}
              />
            </div>
            {preferredTime && (
              <button onClick={() => setPreferredTime('')} style={{ fontSize: 10, color: '#bbb', background: 'none', border: 'none', cursor: 'pointer', marginTop: 3 }}>
                ✕ Retirer l'heure
              </button>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 4 }}>Durée</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {DURATIONS.map(d => (
                <button key={d} onClick={() => setDurationMinutes(durationMinutes === d ? null : d)}
                  style={{ padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${durationMinutes === d ? colors.primary : '#E8E4DF'}`, background: durationMinutes === d ? colors.bg : 'white', fontSize: 11, fontWeight: durationMinutes === d ? 700 : 400, color: durationMinutes === d ? colors.primary : '#aaa', cursor: 'pointer' }}>
                  {d < 60 ? `${d}min` : `${d/60}h`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Aperçu Planner */}
        {preferredTime && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 12, background: colors.bg, border: `1px solid ${colors.light}` }}>
            <p style={{ margin: 0, fontSize: 12, color: colors.primary, fontWeight: 600 }}>
              📅 Apparaîtra dans le Planner à {preferredTime}
              {durationMinutes ? ` · ${durationMinutes} min` : ''}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#aaa' }}>
              {selectedDays.length === 7 ? 'Tous les jours' : selectedDays.map(d => DAY_NAMES[d]).join(', ')}
            </p>
          </div>
        )}

        <button onClick={handleSave} disabled={saving || !title.trim() || selectedDays.length === 0}
          style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', background: title.trim() && selectedDays.length > 0 ? colors.primary : '#E8E4DF', color: title.trim() && selectedDays.length > 0 ? 'white' : '#aaa', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {saving ? <Loader2 size={18} /> : (initial ? '✓ Enregistrer' : '+ Créer le rituel')}
        </button>

        {initial?.id && onDelete && (
          <button onClick={() => onDelete(initial.id)}
            style={{ width: '100%', marginTop: 10, padding: '12px 0', borderRadius: 14, border: '1.5px solid rgba(220,50,50,0.2)', background: 'rgba(220,50,50,0.06)', color: '#c0392b', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            🗑 Supprimer ce rituel
          </button>
        )}
      </div>
    </div>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function RoutinesPage() {
  const router = useRouter()
  const [routines, setRoutines] = useState<Routine[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'morning' | 'evening'>('morning')
  const [showModal, setShowModal] = useState(false)
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null)
  const [showReflection, setShowReflection] = useState(false)
  const [savedFeedback, setSavedFeedback] = useState(false)
  const [conflicts, setConflicts] = useState<ConflictAlert[]>([])
  const [reflection, setReflection] = useState<LocalReflection>({ morningIntention: '', eveningGratitude: '', eveningHighlight: '', morningMood: null })

  const isMorning = activeTab === 'morning'
  const colors = C[activeTab]

  useEffect(() => {
    setActiveTab(new Date().getHours() >= 17 ? 'evening' : 'morning')
    loadRoutines()
    const today = fmtDate(new Date())
    const saved = localStorage.getItem(`novae-reflection-${today}`)
    if (saved) { try { setReflection(JSON.parse(saved)) } catch {} }
  }, [])

  const loadRoutines = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const today = fmtDate(new Date())

    const { data } = await supabase.from('routines').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
    if (data) {
      const processed = data.map((r: any) => ({
        ...r,
        completed: r.last_completed_at ? fmtDate(new Date(r.last_completed_at)) === today && r.completed : false,
      })) as Routine[]
      setRoutines(processed)

      // Vérifier les conflits avec les tâches du jour
      const { data: tasks } = await supabase
        .from('tasks')
        .select('title, start_hour, duration_hours')
        .eq('user_id', user.id)
        .eq('date', today)

      if (tasks && tasks.length > 0) {
        const newConflicts: ConflictAlert[] = []
        processed.forEach(routine => {
          if (!routine.preferred_time || !isScheduledToday(routine)) return
          const rHour = parseInt(routine.preferred_time.split(':')[0])
          const rDurH = (routine.duration_minutes || 60) / 60
          const rEnd = rHour + rDurH

          tasks.forEach((task: any) => {
            const tStart = task.start_hour
            const tEnd = tStart + (task.duration_hours || 1)
            // Chevauchement : routine commence pendant une tâche OU tâche commence pendant la routine
            const overlaps = rHour < tEnd && rEnd > tStart
            if (overlaps) {
              newConflicts.push({ routineTitle: routine.title, conflictTitle: task.title, hour: rHour })
            }
          })
        })
        setConflicts(newConflicts)
      }
    }
    setLoading(false)
  }

  const toggleRoutine = async (routine: Routine) => {
    const newCompleted = !routine.completed
    const now = new Date().toISOString()
    const today = fmtDate(new Date())
    const lastDate = routine.last_completed_at ? fmtDate(new Date(routine.last_completed_at)) : null
    const yesterday = fmtDate(new Date(Date.now() - 86400000))
    const newStreak = newCompleted
      ? (lastDate === yesterday || lastDate === today ? routine.streak_count + 1 : 1)
      : Math.max(0, routine.streak_count - 1)

    setRoutines(prev => prev.map(r => r.id === routine.id ? { ...r, completed: newCompleted, last_completed_at: newCompleted ? now : r.last_completed_at, streak_count: newStreak } : r))
    await supabase.from('routines').update({ completed: newCompleted, last_completed_at: newCompleted ? now : routine.last_completed_at, streak_count: newStreak, updated_at: now }).eq('id', routine.id)
  }

  const createRoutine = async (data: Partial<Routine>) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: inserted } = await supabase.from('routines').insert({
      user_id: user.id, title: data.title, description: data.description,
      category: data.category, frequency: data.frequency, custom_days: data.custom_days,
      preferred_time: data.preferred_time || null,
      duration_minutes: data.duration_minutes || null,
      completed: false, streak_count: 0,
    }).select().single()
    if (inserted) setRoutines(prev => [...prev, inserted as Routine])
    setShowModal(false)
  }

  const updateRoutine = async (data: Partial<Routine>) => {
    if (!editingRoutine) return
    setRoutines(prev => prev.map(r => r.id === editingRoutine.id ? { ...r, ...data } : r))
    await supabase.from('routines').update({
      title: data.title, description: data.description, category: data.category,
      frequency: data.frequency, custom_days: data.custom_days,
      preferred_time: data.preferred_time || null,
      duration_minutes: data.duration_minutes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editingRoutine.id)
    setEditingRoutine(null)
  }

  const deleteRoutine = async (id: string) => {
    setRoutines(prev => prev.filter(r => r.id !== id))
    await supabase.from('routines').delete().eq('id', id)
    setEditingRoutine(null)
  }

  const saveReflection = async () => {
    const today = fmtDate(new Date())
    localStorage.setItem(`novae-reflection-${today}`, JSON.stringify(reflection))
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const entry = isMorning
      ? { type: 'intention', text: reflection.morningIntention, mood: reflection.morningMood, date: today }
      : { type: 'gratitude', text: reflection.eveningGratitude, highlight: reflection.eveningHighlight, date: today }
    const { data: prog } = await supabase.from('program_progress').select('mission_responses').eq('user_id', user.id).single()
    const existing = prog?.mission_responses || []
    const filtered = existing.filter((r: any) => !(r.date === today && r.type === entry.type))
    await supabase.from('program_progress').update({ mission_responses: [...filtered, entry], updated_at: new Date().toISOString() }).eq('user_id', user.id)
    setSavedFeedback(true)
    setTimeout(() => { setSavedFeedback(false); setShowReflection(false) }, 1500)
  }

  const todayRoutines = routines.filter(r => r.category === activeTab && isScheduledToday(r))
  const otherRoutines = routines.filter(r => r.category === activeTab && !isScheduledToday(r))
  const progress = todayRoutines.length > 0 ? Math.round((todayRoutines.filter(r => r.completed).length / todayRoutines.length) * 100) : 0

  return (
    <div className="min-h-screen" style={{ background: '#FAF7F2' }}>
      <Navigation />
      <div className="md:ml-64 pb-24 md:pb-8">
        <main className="px-4 md:px-8 pt-6 max-w-2xl mx-auto">

          {/* Header */}
          <header className="mb-6">
            <button onClick={() => router.push('/')} className="flex items-center gap-2 mb-4 text-sm px-3 py-1.5 rounded-full" style={{ color: '#2C2C2C', opacity: 0.4, background: 'rgba(44,44,44,0.05)' }}>
              <ArrowLeft size={13} /> Accueil
            </button>
            <div className="flex items-start justify-between">
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: colors.primary, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <h1 className="font-serif" style={{ fontSize: 36, color: '#2C2C2C', lineHeight: 1.1, margin: 0 }}>Routines</h1>
              </div>
              <span style={{ fontSize: 40 }}>{isMorning ? '☀️' : '🌙'}</span>
            </div>
          </header>

          {/* Alertes conflits */}
          {conflicts.length > 0 && (
            <div className="mb-5 p-4 rounded-2xl" style={{ background: 'rgba(212,149,106,0.1)', border: '1.5px solid rgba(212,149,106,0.3)' }}>
              <p className="text-sm font-semibold mb-2" style={{ color: '#C4956A', margin: '0 0 8px' }}>⚠️ Conflits détectés aujourd'hui</p>
              {conflicts.map((c, i) => (
                <div key={i} className="text-xs" style={{ color: '#2C2C2C', opacity: 0.7, marginBottom: 4 }}>
                  <strong>{c.routineTitle}</strong> à {String(c.hour).padStart(2,'0')}h chevauche <strong>{c.conflictTitle}</strong>
                </div>
              ))}
              <p className="text-xs mt-2" style={{ color: '#aaa' }}>Pense à reporter ou annuler l'un des deux.</p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-5 p-1 rounded-2xl" style={{ background: 'rgba(196,149,106,0.08)' }}>
            {(['morning', 'evening'] as const).map(tab => {
              const isActive = activeTab === tab
              const c = C[tab]
              const todayCount = routines.filter(r => r.category === tab && isScheduledToday(r))
              const doneCount = todayCount.filter(r => r.completed).length
              return (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200"
                  style={{ background: isActive ? 'white' : 'transparent', color: isActive ? c.primary : '#2C2C2C', opacity: isActive ? 1 : 0.5, boxShadow: isActive ? '0 2px 10px rgba(44,44,44,0.08)' : 'none' }}>
                  {tab === 'morning' ? <Sun size={14} /> : <Moon size={14} />}
                  {tab === 'morning' ? 'Matin' : 'Soir'}
                  {todayCount.length > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: c.primary, color: 'white', fontSize: 10 }}>{doneCount}/{todayCount.length}</span>}
                </button>
              )
            })}
          </div>

          {/* Progress */}
          {todayRoutines.length > 0 && (
            <div className="mb-5">
              <div className="flex justify-between text-xs mb-1.5" style={{ color: '#2C2C2C', opacity: 0.4 }}>
                <span>{todayRoutines.filter(r => r.completed).length}/{todayRoutines.length} rituels aujourd'hui</span>
                <span>{progress}%{progress === 100 ? ' 🎉' : ''}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(196,149,106,0.1)' }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${colors.primary}, ${isMorning ? '#E8B98A' : '#A99CC4'})` }} />
              </div>
            </div>
          )}

          {/* Liste rituels du jour */}
          <div className="mb-4 rounded-2xl overflow-hidden" style={{ background: 'white', boxShadow: '0 2px 14px rgba(44,44,44,0.05)' }}>
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin" style={{ color: colors.primary }} /></div>
            ) : todayRoutines.length === 0 ? (
              <div className="text-center py-10">
                <div style={{ fontSize: 36 }} className="mb-2">{isMorning ? '🌄' : '🌃'}</div>
                <p className="text-sm" style={{ color: '#2C2C2C', opacity: 0.4 }}>Aucun rituel prévu aujourd'hui</p>
                <p className="text-xs mt-1" style={{ color: '#2C2C2C', opacity: 0.25 }}>Crée tes premiers rituels ↓</p>
              </div>
            ) : (
              todayRoutines.map((routine, i) => {
                const hasConflict = conflicts.some(c => c.routineTitle === routine.title)
                return (
                  <div key={routine.id} className="flex items-center gap-3 px-4 py-3.5 transition-all"
                    style={{ borderBottom: i < todayRoutines.length - 1 ? '1px solid rgba(44,44,44,0.05)' : 'none', background: hasConflict ? 'rgba(212,149,106,0.06)' : routine.completed ? colors.bg : 'transparent' }}>
                    <button onClick={() => toggleRoutine(routine)}
                      className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200"
                      style={{ borderColor: routine.completed ? colors.primary : 'rgba(44,44,44,0.2)', background: routine.completed ? colors.primary : 'transparent' }}>
                      {routine.completed && <Check size={12} color="white" strokeWidth={3} />}
                    </button>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{routine.description || '✨'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="text-sm font-medium" style={{ color: '#2C2C2C', opacity: routine.completed ? 0.4 : 1, textDecoration: routine.completed ? 'line-through' : 'none', margin: 0 }}>
                        {routine.title}
                        {hasConflict && <span style={{ marginLeft: 6, fontSize: 12 }}>⚠️</span>}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs" style={{ color: '#2C2C2C', opacity: 0.3, margin: 0 }}>{getFrequencyLabel(routine)}</p>
                        {routine.preferred_time && (
                          <span className="text-xs flex items-center gap-1" style={{ color: colors.primary, opacity: 0.8 }}>
                            <Clock size={10} /> {getTimeLabel(routine)}
                            <span style={{ fontSize: 9, background: colors.bg, padding: '1px 5px', borderRadius: 6, color: colors.primary }}>📅 Planner</span>
                          </span>
                        )}
                      </div>
                    </div>
                    {routine.streak_count > 1 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: '#FBF0CC', color: '#7A6010', border: '1px solid #E8D080' }}>🔥{routine.streak_count}</span>
                    )}
                    <button onClick={() => setEditingRoutine(routine)} className="flex-shrink-0 p-1.5 rounded-lg opacity-20 hover:opacity-60 transition-opacity" style={{ color: '#2C2C2C' }}>
                      <Edit2 size={14} />
                    </button>
                  </div>
                )
              })
            )}

            {otherRoutines.length > 0 && (
              <div style={{ borderTop: '1px solid rgba(44,44,44,0.05)', padding: '10px 16px' }}>
                <p className="text-xs mb-2" style={{ color: '#2C2C2C', opacity: 0.25 }}>Pas prévus aujourd'hui</p>
                {otherRoutines.map(routine => (
                  <div key={routine.id} className="flex items-center gap-3 py-1.5 opacity-35">
                    <span style={{ fontSize: 16 }}>{routine.description || '✨'}</span>
                    <span className="text-xs flex-1" style={{ color: '#2C2C2C' }}>{routine.title}</span>
                    <span className="text-xs" style={{ color: '#2C2C2C', opacity: 0.5 }}>{getFrequencyLabel(routine)}</span>
                    <button onClick={() => setEditingRoutine(routine)} className="p-1 opacity-50"><Edit2 size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mb-5">
            <button onClick={() => setShowModal(true)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold"
              style={{ background: colors.primary, color: 'white' }}>
              <Plus size={18} /> Nouveau rituel
            </button>
            <button onClick={() => setShowReflection(!showReflection)}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-sm font-semibold"
              style={{ background: showReflection ? colors.bg : 'white', color: colors.primary, border: `1.5px solid ${colors.light}` }}>
              {isMorning ? <Sparkles size={16} /> : <Star size={16} />}
              {isMorning ? 'Intention' : 'Gratitude'}
            </button>
          </div>

          {/* Réflexion */}
          {showReflection && (
            <div className="mb-5 p-5 rounded-2xl" style={{ background: 'white', boxShadow: '0 2px 14px rgba(44,44,44,0.05)' }}>
              {isMorning && (
                <div className="mb-4">
                  <p className="text-xs font-semibold mb-2" style={{ color: '#2C2C2C', opacity: 0.3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Mon énergie ce matin</p>
                  <div className="flex flex-wrap gap-2">
                    {MOODS.map(m => (
                      <button key={m.emoji} onClick={() => setReflection(s => ({ ...s, morningMood: m.emoji }))}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all"
                        style={{ background: reflection.morningMood === m.emoji ? colors.primary : colors.bg, color: reflection.morningMood === m.emoji ? 'white' : '#2C2C2C', border: `1.5px solid ${reflection.morningMood === m.emoji ? colors.primary : 'transparent'}` }}>
                        {m.emoji} {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {isMorning ? (
                <>
                  <div className="flex items-center gap-2 mb-2"><Sparkles size={14} style={{ color: colors.primary }} /><p className="text-sm font-semibold" style={{ color: '#2C2C2C', margin: 0 }}>Mon intention du jour</p></div>
                  {reflection.morningIntention && (
                    <div className="mb-2 px-3 py-2 rounded-xl text-sm italic" style={{ background: colors.bg, color: '#2C2C2C', opacity: 0.8 }}>"{reflection.morningIntention}"</div>
                  )}
                  <textarea value={reflection.morningIntention} onChange={e => setReflection(s => ({ ...s, morningIntention: e.target.value }))} placeholder="Je veux aujourd'hui ressentir, accomplir, être..." rows={3} className="w-full text-sm px-4 py-3 rounded-xl border-0 outline-none resize-none" style={{ background: colors.bg, color: '#2C2C2C' }} />
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2"><Star size={14} style={{ color: colors.primary }} /><p className="text-sm font-semibold" style={{ color: '#2C2C2C', margin: 0 }}>Ma gratitude du soir</p></div>
                  <textarea value={reflection.eveningGratitude} onChange={e => setReflection(s => ({ ...s, eveningGratitude: e.target.value }))} placeholder="Aujourd'hui je suis reconnaissante pour..." rows={3} className="w-full text-sm px-4 py-3 rounded-xl border-0 outline-none resize-none mb-3" style={{ background: colors.bg, color: '#2C2C2C' }} />
                  <div className="flex items-center gap-2 mb-2"><Flame size={14} style={{ color: colors.primary }} /><p className="text-sm font-semibold" style={{ color: '#2C2C2C', margin: 0 }}>Le moment fort du jour</p></div>
                  <textarea value={reflection.eveningHighlight} onChange={e => setReflection(s => ({ ...s, eveningHighlight: e.target.value }))} placeholder="Ce qui m'a rendue fière ou heureuse aujourd'hui..." rows={2} className="w-full text-sm px-4 py-3 rounded-xl border-0 outline-none resize-none" style={{ background: colors.bg, color: '#2C2C2C' }} />
                </>
              )}
              <button onClick={saveReflection} className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold transition-all" style={{ background: savedFeedback ? '#7BAF8E' : colors.primary, color: 'white' }}>
                {savedFeedback ? '✓ Enregistré !' : isMorning ? 'Valider mon intention' : 'Valider ma soirée'}
              </button>
            </div>
          )}

          {/* Quote */}
          <div className="p-4 rounded-2xl text-center" style={{ background: `linear-gradient(135deg, ${colors.bg}, rgba(255,255,255,0))` }}>
            <Wind size={14} className="mx-auto mb-1.5" style={{ color: colors.primary, opacity: 0.35 }} />
            <p className="text-sm font-serif italic" style={{ color: '#2C2C2C', opacity: 0.5 }}>
              {isMorning ? '"Chaque matin, tu renaîs. Ce que tu fais aujourd\'hui est ce qui compte."' : '"La nuit est un repos mérité. Demain, une nouvelle page t\'attend."'}
            </p>
          </div>

        </main>
      </div>

      {showModal && <RoutineModal defaultCategory={activeTab} onSave={createRoutine} onClose={() => setShowModal(false)} />}
      {editingRoutine && (
        <RoutineModal initial={editingRoutine} onSave={updateRoutine} onDelete={(id) => { deleteRoutine(id); setEditingRoutine(null) }} onClose={() => setEditingRoutine(null)} />
      )}
    </div>
  )
}