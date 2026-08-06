'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Clock3,
  Dumbbell,
  Edit3,
  HeartPulse,
  Leaf,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import Navigation from '@/components/Navigation'
import { supabase } from '@/lib/supabase/client'
import { logEvent } from '@/lib/events'

type Moment = 'morning' | 'evening'

type Routine = {
  id: string
  title: string
  description: string | null
  category: Moment
  frequency: string
  custom_days: string | string[] | null
  completed: boolean
  last_completed_at: string | null
  streak_count: number
  reminder_enabled: boolean
  reminder_minutes_before: number
  preferred_time: string | null
  duration_minutes: number | null
  user_id?: string
}

type RoutineTemplate = {
  key: string
  label: string
  emoji: string
  title: string
  subtitle: string
  icon: typeof Dumbbell
  examples: string[]
  defaultDuration: number
  defaultMoment: Moment
}

const COLORS = {
  background: 'var(--novae-background, #F8F1E5)',
  surface: 'var(--novae-surface, #FFFFFF)',
  surfaceAlt: 'var(--novae-surface-alt, #F5EFE6)',
  ink: 'var(--novae-text-main, #3D2618)',
  muted: 'var(--novae-text-muted, #786A5F)',
  border: 'var(--novae-border, rgba(61,38,24,0.10))',
  gold: 'var(--novae-metal, #B78A3D)',
  goldSoft: 'var(--novae-primary-soft, rgba(183,138,61,0.12))',
  success: '#5F8C70',
  successSoft: 'rgba(95,140,112,0.12)',
  danger: '#B05D5D',
  shadow: 'var(--novae-shadow, rgba(61,38,24,0.10))',
}

const DAYS = [
  { key: 'mon', short: 'L', label: 'Lundi' },
  { key: 'tue', short: 'M', label: 'Mardi' },
  { key: 'wed', short: 'M', label: 'Mercredi' },
  { key: 'thu', short: 'J', label: 'Jeudi' },
  { key: 'fri', short: 'V', label: 'Vendredi' },
  { key: 'sat', short: 'S', label: 'Samedi' },
  { key: 'sun', short: 'D', label: 'Dimanche' },
]

const DAY_NAMES: Record<string, string> = {
  mon: 'lun.', tue: 'mar.', wed: 'mer.', thu: 'jeu.', fri: 'ven.', sat: 'sam.', sun: 'dim.',
}

const TODAY_KEY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()]
const DURATIONS = [10, 15, 20, 30, 45, 60, 90]

const TEMPLATES: RoutineTemplate[] = [
  {
    key: 'sport', label: 'Sport', emoji: '🏃', title: 'Bouger régulièrement', subtitle: 'Créer un rendez-vous réaliste avec ton corps',
    icon: Dumbbell, examples: ['Marche rapide', 'Yoga', 'Renforcement', 'Course'], defaultDuration: 30, defaultMoment: 'morning',
  },
  {
    key: 'wellbeing', label: 'Bien-être', emoji: '🧘', title: 'Prendre une vraie pause', subtitle: 'Respiration, méditation ou moment calme',
    icon: Leaf, examples: ['Respiration', 'Méditation', 'Étirements', 'Pause sans écran'], defaultDuration: 10, defaultMoment: 'morning',
  },
  {
    key: 'health', label: 'Santé', emoji: '💧', title: 'Prendre soin de ma santé', subtitle: 'Une action simple, répétée au bon moment',
    icon: HeartPulse, examples: ['Boire de l’eau', 'Prendre mes vitamines', 'Préparer mes médicaments', 'Me coucher plus tôt'], defaultDuration: 10, defaultMoment: 'morning',
  },
  {
    key: 'learning', label: 'Lecture', emoji: '📖', title: 'Lire ou apprendre', subtitle: 'Un temps protégé pour nourrir ton esprit',
    icon: BookOpen, examples: ['Lire 20 minutes', 'Apprendre une langue', 'Formation', 'Journal'], defaultDuration: 20, defaultMoment: 'evening',
  },
  {
    key: 'organisation', label: 'Organisation', emoji: '🗂️', title: 'Alléger la semaine', subtitle: 'Une petite routine pour ne plus tout garder en tête',
    icon: BriefcaseBusiness, examples: ['Préparer demain', 'Ranger 15 minutes', 'Trier les papiers', 'Planifier la semaine'], defaultDuration: 15, defaultMoment: 'evening',
  },
]

function parseDays(value: Routine['custom_days']): string[] {
  if (Array.isArray(value)) return value
  if (!value || value === 'null') return DAYS.map(day => day.key)
  if (value.startsWith('{')) return value.replace(/[{}]/g, '').split(',').map(item => item.trim()).filter(Boolean)
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : DAYS.map(day => day.key)
  } catch {
    return value.split(',').map(item => item.trim()).filter(Boolean)
  }
}

function isScheduledToday(routine: Routine): boolean {
  if (routine.frequency === 'daily') return true
  const days = parseDays(routine.custom_days)
  return days.length === 0 || days.length === 7 || days.includes(TODAY_KEY)
}

function formatDays(routine: Routine): string {
  const days = parseDays(routine.custom_days)
  if (routine.frequency === 'daily' || days.length === 0 || days.length === 7) return 'Tous les jours'
  return days.map(day => DAY_NAMES[day] || day).join(' · ')
}

function formatTime(routine: Routine): string {
  const time = routine.preferred_time?.slice(0, 5)
  const duration = routine.duration_minutes ? `${routine.duration_minutes} min` : null
  return [time, duration].filter(Boolean).join(' · ') || 'Horaire libre'
}

function inferTemplate(routine: Routine): RoutineTemplate | null {
  return TEMPLATES.find(template => routine.description === template.emoji) || null
}

function RoutineForm({
  initial,
  template,
  onClose,
  onSave,
  onDelete,
}: {
  initial?: Routine | null
  template?: RoutineTemplate | null
  onClose: () => void
  onSave: (data: Partial<Routine>) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [title, setTitle] = useState(initial?.title || template?.examples[0] || '')
  const [emoji, setEmoji] = useState(initial?.description || template?.emoji || '✨')
  const [moment, setMoment] = useState<Moment>(initial?.category || template?.defaultMoment || 'morning')
  const [days, setDays] = useState<string[]>(initial ? parseDays(initial.custom_days) : ['mon', 'wed', 'fri'])
  const [time, setTime] = useState(initial?.preferred_time?.slice(0, 5) || (moment === 'morning' ? '07:30' : '19:00'))
  const [duration, setDuration] = useState(initial?.duration_minutes || template?.defaultDuration || 20)
  const [reminder, setReminder] = useState(initial?.reminder_enabled ?? true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const canSave = title.trim().length > 1 && days.length > 0

  const toggleDay = (key: string) => {
    setDays(current => current.includes(key) ? current.filter(day => day !== key) : [...current, key])
  }

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setFormError(null)
    try {
      await onSave({
        title: title.trim(),
        description: emoji,
        category: moment,
        frequency: days.length === 7 ? 'daily' : 'custom',
        custom_days: `{${days.join(',')}}`,
        preferred_time: time || null,
        duration_minutes: duration,
        reminder_enabled: reminder,
        reminder_minutes_before: 15,
      })
    } catch (error) {
      console.error('[routines] save failed', error)
      setFormError("La routine n'a pas pu être enregistrée. Réessaie dans un instant.")
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!onDelete || !window.confirm('Supprimer cette routine ?')) return
    setDeleting(true)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 md:items-center md:p-6" role="dialog" aria-modal="true">
      <div className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-t-[28px] px-5 pb-8 pt-4 shadow-2xl md:rounded-[28px] md:p-7" style={{ background: COLORS.surface, color: COLORS.ink }}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-200 md:hidden" />
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: COLORS.gold }}>
              {initial ? 'Modifier' : 'Nouvelle routine'}
            </p>
            <h2 className="m-0 font-serif text-3xl" style={{ color: COLORS.ink }}>
              {initial ? initial.title : template?.label || 'Ma routine'}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-stone-100" aria-label="Fermer"><X size={20} /></button>
        </div>

        {template && !initial && (
          <div className="mb-5 rounded-2xl p-4" style={{ background: COLORS.goldSoft }}>
            <p className="mb-2 text-sm font-semibold" style={{ color: COLORS.ink }}>Une idée pour commencer</p>
            <div className="flex flex-wrap gap-2">
              {template.examples.map(example => (
                <button key={example} onClick={() => setTitle(example)} className="rounded-full px-3 py-2 text-xs font-medium shadow-sm" style={{ color: COLORS.ink, background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="mb-5 block">
          <span className="mb-2 block text-sm font-semibold" style={{ color: COLORS.ink }}>Qu’est-ce que tu veux faire ?</span>
          <div className="flex gap-2">
            <input value={emoji} onChange={event => setEmoji(event.target.value.slice(0, 2))} className="h-12 w-14 rounded-xl border text-center text-xl" style={{ borderColor: COLORS.border, color: COLORS.ink, background: COLORS.surface, colorScheme: 'light' }} aria-label="Emoji" />
            <input value={title} onChange={event => setTitle(event.target.value)} className="h-12 flex-1 rounded-xl border px-4 text-sm outline-none focus:ring-2" style={{ borderColor: COLORS.border, color: COLORS.ink, background: COLORS.surface, colorScheme: 'light' }} placeholder="Ex. Marche rapide" autoFocus />
          </div>
        </label>

        <div className="mb-5">
          <p className="mb-2 text-sm font-semibold" style={{ color: COLORS.ink }}>À quel moment ?</p>
          <div className="grid grid-cols-2 gap-2">
            {(['morning', 'evening'] as Moment[]).map(value => (
              <button key={value} onClick={() => { setMoment(value); if (!initial) setTime(value === 'morning' ? '07:30' : '19:00') }} className="rounded-xl border px-4 py-3 text-sm font-semibold" style={{ borderColor: moment === value ? COLORS.gold : COLORS.border, background: moment === value ? COLORS.goldSoft : COLORS.surface, color: COLORS.ink }}>
                {value === 'morning' ? '☀️ Matin' : '🌙 Soir'}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <p className="mb-2 text-sm font-semibold" style={{ color: COLORS.ink }}>Quels jours ?</p>
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map(day => {
              const active = days.includes(day.key)
              return (
                <button key={day.key} onClick={() => toggleDay(day.key)} title={day.label} className="aspect-square rounded-xl border text-xs font-bold" style={{ borderColor: active ? COLORS.gold : COLORS.border, background: active ? COLORS.gold : COLORS.surface, color: active ? 'white' : COLORS.muted }}>
                  {day.short}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex gap-2">
            <button onClick={() => setDays(DAYS.slice(0, 5).map(day => day.key))} className="text-xs font-semibold" style={{ color: COLORS.gold }}>En semaine</button>
            <span className="text-stone-300">·</span>
            <button onClick={() => setDays(DAYS.map(day => day.key))} className="text-xs font-semibold" style={{ color: COLORS.gold }}>Tous les jours</button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <label>
            <span className="mb-2 block text-sm font-semibold" style={{ color: COLORS.ink }}>Heure</span>
            <input type="time" value={time} onChange={event => setTime(event.target.value)} className="h-12 w-full rounded-xl border px-3 text-sm" style={{ borderColor: COLORS.border, color: COLORS.ink, background: COLORS.surface, colorScheme: 'light' }} />
          </label>
          <div>
            <p className="mb-2 text-sm font-semibold" style={{ color: COLORS.ink }}>Durée</p>
            <select value={duration} onChange={event => setDuration(Number(event.target.value))} className="h-12 w-full rounded-xl border px-3 text-sm" style={{ borderColor: COLORS.border, color: COLORS.ink, background: COLORS.surface, colorScheme: 'light' }}>
              {DURATIONS.map(value => <option key={value} value={value}>{value} min</option>)}
            </select>
          </div>
        </div>

        <button onClick={() => setReminder(value => !value)} className="mb-6 flex w-full items-center justify-between rounded-2xl border p-4 text-left" style={{ borderColor: COLORS.border, background: COLORS.surfaceAlt }}>
          <div>
            <p className="m-0 text-sm font-semibold" style={{ color: COLORS.ink }}>Me le rappeler</p>
            <p className="m-0 mt-1 text-xs" style={{ color: COLORS.muted }}>Un rappel doux 15 minutes avant</p>
          </div>
          <span className="relative h-7 w-12 rounded-full transition" style={{ background: reminder ? COLORS.success : '#D6D1CC' }}>
            <span className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: reminder ? 24 : 4 }} />
          </span>
        </button>

        {formError && (
          <p className="mb-3 rounded-xl px-3 py-2 text-sm" style={{ background: 'rgba(176,93,93,.10)', color: COLORS.danger }}>
            {formError}
          </p>
        )}

        <div className="flex gap-3">
          {onDelete && (
            <button onClick={remove} disabled={deleting} className="flex h-12 w-12 items-center justify-center rounded-xl border" style={{ borderColor: 'rgba(176,93,93,.25)', color: COLORS.danger }} aria-label="Supprimer">
              {deleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
            </button>
          )}
          <button onClick={save} disabled={!canSave || saving} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: COLORS.gold }}>
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            {initial ? 'Enregistrer les modifications' : 'Créer ma routine'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RoutinesPage() {
  const router = useRouter()
  const [routines, setRoutines] = useState<Routine[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<RoutineTemplate | null>(null)
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null)
  const [customOpen, setCustomOpen] = useState(false)

  useEffect(() => {
    void loadRoutines()
  }, [])

  const loadRoutines = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    logEvent(supabase, user.id, 'module_routines')
    const { data, error } = await supabase.from('routines').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
    if (!error) setRoutines((data || []) as Routine[])
    setLoading(false)
  }

  const todayRoutines = useMemo(
    () => routines.filter(isScheduledToday).sort((a, b) => (a.preferred_time || '99:99').localeCompare(b.preferred_time || '99:99')),
    [routines],
  )
  const completedCount = todayRoutines.filter(routine => routine.completed).length
  const progress = todayRoutines.length ? Math.round((completedCount / todayRoutines.length) * 100) : 0

  const toggleRoutine = async (routine: Routine) => {
    setBusyId(routine.id)
    const completed = !routine.completed
    const now = new Date().toISOString()
    const previous = routines
    setRoutines(current => current.map(item => item.id === routine.id ? {
      ...item,
      completed,
      last_completed_at: completed ? now : item.last_completed_at,
      streak_count: completed ? Math.max(1, item.streak_count || 0) : Math.max(0, (item.streak_count || 0) - 1),
    } : item))

    const { error } = await supabase.from('routines').update({
      completed,
      last_completed_at: completed ? now : routine.last_completed_at,
      streak_count: completed ? Math.max(1, routine.streak_count || 0) : Math.max(0, (routine.streak_count || 0) - 1),
      updated_at: now,
    }).eq('id', routine.id)
    if (error) setRoutines(previous)
    setBusyId(null)
  }

  const createRoutine = async (data: Partial<Routine>) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: inserted, error } = await supabase.from('routines').insert({
      user_id: user.id,
      title: data.title,
      description: data.description,
      category: data.category,
      frequency: data.frequency,
      custom_days: data.custom_days,
      completed: false,
      streak_count: 0,
      reminder_enabled: data.reminder_enabled ?? true,
      reminder_minutes_before: data.reminder_minutes_before ?? 15,
      preferred_time: data.preferred_time || null,
      duration_minutes: data.duration_minutes || null,
    }).select().single()
    if (error) throw error
    setRoutines(current => [...current, inserted as Routine])
    setSelectedTemplate(null)
    setCustomOpen(false)
  }

  const updateRoutine = async (data: Partial<Routine>) => {
    if (!editingRoutine) return
    const { data: updated, error } = await supabase.from('routines').update({
      title: data.title,
      description: data.description,
      category: data.category,
      frequency: data.frequency,
      custom_days: data.custom_days,
      reminder_enabled: data.reminder_enabled,
      reminder_minutes_before: data.reminder_minutes_before,
      preferred_time: data.preferred_time || null,
      duration_minutes: data.duration_minutes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editingRoutine.id).select().single()
    if (error) throw error
    setRoutines(current => current.map(item => item.id === editingRoutine.id ? updated as Routine : item))
    setEditingRoutine(null)
  }

  const deleteRoutine = async () => {
    if (!editingRoutine) return
    const { error } = await supabase.from('routines').delete().eq('id', editingRoutine.id)
    if (error) throw error
    setRoutines(current => current.filter(item => item.id !== editingRoutine.id))
    setEditingRoutine(null)
  }

  return (
    <div className="min-h-screen" style={{ background: COLORS.background, color: COLORS.ink }}>
      <Navigation />
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pt-10">
        <button onClick={() => router.push('/')} className="mb-5 flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium" style={{ background: COLORS.surfaceAlt, color: COLORS.muted }}>
          <ArrowLeft size={15} /> Accueil
        </button>

        <header className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: COLORS.gold }}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="m-0 font-serif text-4xl md:text-5xl">Mes routines</h1>
            <p className="mb-0 mt-2 max-w-xl text-sm leading-6" style={{ color: COLORS.muted }}>
              Planifie ce qui te fait du bien. Tes routines apparaissent automatiquement dans le Planner.
            </p>
          </div>
          <button onClick={() => setCustomOpen(true)} className="flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-sm" style={{ background: COLORS.gold }}>
            <Plus size={18} /> Créer ma routine
          </button>
        </header>

        <section className="mb-8 rounded-[26px] border p-5 shadow-sm md:p-7" style={{ borderColor: COLORS.border, background: COLORS.surface, boxShadow: `0 13px 34px ${COLORS.shadow}` }}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Sparkles size={17} style={{ color: COLORS.gold }} />
                <h2 className="m-0 font-serif text-2xl">Aujourd’hui</h2>
              </div>
              <p className="m-0 text-sm" style={{ color: COLORS.muted }}>
                {todayRoutines.length === 0 ? 'Aucune routine prévue. Ta journée reste libre.' : `${completedCount} réalisée${completedCount > 1 ? 's' : ''} sur ${todayRoutines.length}`}
              </p>
            </div>
            {todayRoutines.length > 0 && <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: COLORS.successSoft, color: COLORS.success }}>{progress}%</span>}
          </div>

          {todayRoutines.length > 0 && (
            <div className="mb-5 h-2 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: COLORS.success }} />
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin" style={{ color: COLORS.gold }} /></div>
          ) : todayRoutines.length === 0 ? (
            <button onClick={() => setCustomOpen(true)} className="flex w-full items-center justify-between rounded-2xl border border-dashed p-4 text-left" style={{ borderColor: 'rgba(183,138,61,.35)', background: COLORS.goldSoft }}>
              <div><p className="m-0 text-sm font-bold">Ajouter une première routine</p><p className="m-0 mt-1 text-xs" style={{ color: COLORS.muted }}>Commence petit : 10 à 20 minutes suffisent.</p></div>
              <ChevronRight size={18} />
            </button>
          ) : (
            <div className="space-y-3">
              {todayRoutines.map(routine => {
                const template = inferTemplate(routine)
                return (
                  <div key={routine.id} className="flex items-center gap-3 rounded-2xl border p-3.5 transition" style={{ borderColor: routine.completed ? 'rgba(95,140,112,.25)' : COLORS.border, background: routine.completed ? COLORS.successSoft : COLORS.surfaceAlt }}>
                    <button onClick={() => void toggleRoutine(routine)} disabled={busyId === routine.id} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 transition" style={{ borderColor: routine.completed ? COLORS.success : 'rgba(61,38,24,.18)', background: routine.completed ? COLORS.success : COLORS.surface, color: 'white' }} aria-label={routine.completed ? 'Marquer comme non réalisée' : 'Marquer comme réalisée'}>
                      {busyId === routine.id ? <Loader2 size={18} className="animate-spin" style={{ color: routine.completed ? 'white' : COLORS.gold }} /> : routine.completed ? <Check size={21} strokeWidth={3} /> : <span className="text-xl">{routine.description || template?.emoji || '✨'}</span>}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-sm font-bold" style={{ textDecoration: routine.completed ? 'line-through' : 'none', opacity: routine.completed ? .55 : 1 }}>{routine.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: COLORS.muted }}>
                        <span className="flex items-center gap-1"><Clock3 size={12} /> {formatTime(routine)}</span>
                        <span>{routine.category === 'morning' ? 'Matin' : 'Soir'}</span>
                        {(routine.streak_count || 0) > 1 && <span>🔥 {routine.streak_count} jours</span>}
                      </div>
                    </div>
                    <button onClick={() => setEditingRoutine(routine)} className="rounded-xl p-2" aria-label="Modifier"><Edit3 size={17} style={{ color: COLORS.muted }} /></button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="mb-8">
          <div className="mb-4">
            <h2 className="m-0 font-serif text-2xl">Choisis une idée</h2>
            <p className="m-0 mt-1 text-sm" style={{ color: COLORS.muted }}>Une base simple que tu peux entièrement personnaliser.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {TEMPLATES.map(template => {
              const Icon = template.icon
              return (
                <button key={template.key} onClick={() => setSelectedTemplate(template)} className="group rounded-[22px] border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: COLORS.border, background: COLORS.surface, color: COLORS.ink }}>
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: COLORS.goldSoft, color: COLORS.gold }}><Icon size={21} /></div>
                  <p className="m-0 text-sm font-bold">{template.label}</p>
                  <p className="mb-0 mt-1 text-xs leading-5" style={{ color: COLORS.muted }}>{template.subtitle}</p>
                  <span className="mt-4 flex items-center gap-1 text-xs font-bold" style={{ color: COLORS.gold }}>Créer <ChevronRight size={14} /></span>
                </button>
              )
            })}
          </div>
        </section>

      </main>

      {(selectedTemplate || customOpen) && (
        <RoutineForm template={selectedTemplate} onClose={() => { setSelectedTemplate(null); setCustomOpen(false) }} onSave={createRoutine} />
      )}
      {editingRoutine && (
        <RoutineForm initial={editingRoutine} onClose={() => setEditingRoutine(null)} onSave={updateRoutine} onDelete={deleteRoutine} />
      )}
    </div>
  )
}
