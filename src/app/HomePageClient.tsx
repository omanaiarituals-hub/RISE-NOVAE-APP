// src/app/HomePageClient.tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import NotificationBell from '@/components/NotificationBell'
import Navigation from '@/components/Navigation'
import { UserMenu } from '@/components/UserMenu'
import PremiumIcon, {
  type PremiumIconName,
} from '@/components/ui/PremiumIcon'
import { usePseudo } from '@/hooks/usePseudo'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { logEvent } from '@/lib/events'
import { supabase } from '@/lib/supabase/client'
import {
  getUserInterfacePreset,
  normalizeUserThemeKey,
  type UserPointMode,
  type UserThemeKey,
} from '@/lib/theme/user-themes'

const ADMIN_EMAILS = [
  'nesserinesediri@gmail.com',
  'omanaiarituals@gmail.com',
]
const PARIS_TIME_ZONE = 'Europe/Paris'
const CACHE_KEY = 'novae-interface-preferences'

type TimelineItem = {
  id: string
  title: string
  startMinutes: number
  endMinutes: number
  kind: 'event' | 'routine'
}

type PriorityItem = {
  id: string
  title: string
  priority?: string | null
}

type ModuleItem = {
  key: string
  href: string
  title: string
  description: string
  icon: PremiumIconName
  adminOnly?: boolean
}

const ALL_MODULES: ModuleItem[] = [
  { key: 'planner', href: '/planner', title: 'Planner', description: 'Organise ta journée', icon: 'calendar' },
  { key: 'todo', href: '/todo', title: 'To-do', description: 'Gère tes tâches', icon: 'check' },
  { key: 'meals', href: '/recipes', title: 'Repas', description: 'Inspire et régale', icon: 'meal' },
  { key: 'notes', href: '/notes', title: 'Notes', description: 'Idées et informations', icon: 'notes' },
  { key: 'admin', href: '/admin-documents', title: 'Documents', description: 'Centralise et retrouve', icon: 'document' },
  { key: 'family', href: '/family', title: 'Entourage', description: 'Foyer, proches et réseau', icon: 'family' },
  { key: 'routines', href: '/routines', title: 'Routines', description: 'Habitudes du quotidien', icon: 'routine' },
]

const DEFAULT_PRIMARY_MODULE_KEYS = ['planner', 'todo', 'meals']
const MODULES_CACHE_KEY = 'novae-primary-modules'

const OTHER_MODULES: ModuleItem[] = [
  { key: 'astuces', href: '/astuces', title: 'Astuces', description: 'Conseils pratiques', icon: 'idea' },
  { key: 'blog', href: '/blog', title: 'Ressources', description: 'Articles et contenus', icon: 'book' },
  { key: 'finance', href: '/finances', title: 'Finances', description: 'Bientôt disponible', icon: 'wallet' },
]

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function getParisParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: PARIS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || 0)

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
  }
}

function formatParisDate(date = new Date()) {
  const parts = getParisParts(date)

  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(
    parts.day,
  ).padStart(2, '0')}`
}

function minutesToLabel(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
    2,
    '0',
  )}`
}

function timelineWindowLabel(start: number, end: number) {
  return `${minutesToLabel(start)} – ${minutesToLabel(end)}${
    end >= 1440 ? ' demain' : ''
  }`
}

function parseTimeToMinutes(value: string | null | undefined) {
  if (!value) return 0

  const [hours, minutes] = value.split(':').map(Number)
  return (hours || 0) * 60 + (minutes || 0)
}

function readCachedTheme(): UserThemeKey {
  if (typeof window === 'undefined') return 'deep_emerald'

  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return normalizeUserThemeKey(parsed?.theme_key)
  } catch {
    return 'deep_emerald'
  }
}

export default function HomePageClient() {
  const { user, loading } = useSupabaseAuth()
  const pseudo = usePseudo()
  const router = useRouter()

  const [themeKey, setThemeKey] =
    useState<UserThemeKey>('deep_emerald')
  const [greeting, setGreeting] = useState('Bonjour')
  const [dateLabel, setDateLabel] = useState('')
  const [timelineWindow, setTimelineWindow] = useState({
    start: 0,
    end: 180,
  })
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [priorityItems, setPriorityItems] = useState<PriorityItem[]>([])
  const [documentCount, setDocumentCount] = useState(0)
  const [showAllModules, setShowAllModules] = useState(false)
  const [showModulePicker, setShowModulePicker] = useState(false)
  const [primaryModuleKeys, setPrimaryModuleKeys] = useState<string[]>(
    DEFAULT_PRIMARY_MODULE_KEYS,
  )
  const [novaPending, setNovaPending] = useState<{
    thread_id: string
  } | null>(null)

  const [showObjective, setShowObjective] = useState(false)
  const [intention, setIntention] = useState('')
  const [priorite, setPriorite] = useState('')
  const [objectiveLoading, setObjectiveLoading] = useState(false)
  const [objectiveSaved, setObjectiveSaved] = useState(false)
  const [objective, setObjective] = useState<{
    intention: string
    priorite: string
  } | null>(null)

  const isAdmin = Boolean(
    user?.email &&
      ADMIN_EMAILS.includes(user.email.toLowerCase()),
  )
  const pointMode: UserPointMode =
    getUserInterfacePreset(themeKey).pointMode

  const novaHref = useMemo(() => {
    if (isAdmin) return '/nova-v2'
    if (novaPending) {
      return '/nova-v2'
    }
    return '/nova-v2'
  }, [isAdmin, novaPending])

  const visiblePrimaryModules = useMemo(
    () =>
      primaryModuleKeys
        .map((key) => ALL_MODULES.find((module) => module.key === key))
        .filter((module): module is ModuleItem => Boolean(module)),
    [primaryModuleKeys],
  )

  const visibleOtherModules = useMemo(() => {
    const combined = [
      ...ALL_MODULES.filter(
        (module) => !primaryModuleKeys.includes(module.key),
      ),
      ...OTHER_MODULES,
    ]

    return combined.filter(
      (module, index, list) =>
        (!module.adminOnly || isAdmin) &&
        list.findIndex((item) => item.key === module.key) === index,
    )
  }, [isAdmin, primaryModuleKeys])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MODULES_CACHE_KEY)
      const parsed = saved ? JSON.parse(saved) : null

      if (
        Array.isArray(parsed) &&
        parsed.length === 3 &&
        parsed.every((key) =>
          ALL_MODULES.some((module) => module.key === key),
        )
      ) {
        setPrimaryModuleKeys(parsed)
      }
    } catch {
      setPrimaryModuleKeys(DEFAULT_PRIMARY_MODULE_KEYS)
    }
  }, [])

  useEffect(() => {
    const syncTheme = (event?: Event) => {
      const customEvent = event as
        | CustomEvent<{ theme_key?: string }>
        | undefined

      setThemeKey(
        normalizeUserThemeKey(
          customEvent?.detail?.theme_key || readCachedTheme(),
        ),
      )
    }

    syncTheme()

    window.addEventListener('novae-theme-updated', syncTheme)

    return () => {
      window.removeEventListener('novae-theme-updated', syncTheme)
    }
  }, [])

  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      const paris = getParisParts(now)
      const currentMinutes = paris.hour * 60 + paris.minute

      setGreeting(
        paris.hour < 5
          ? 'Bonne nuit'
          : paris.hour < 12
            ? 'Bonjour'
            : paris.hour < 18
              ? 'Bonne après-midi'
              : 'Bonsoir',
      )

      setDateLabel(
        now.toLocaleDateString('fr-FR', {
          timeZone: PARIS_TIME_ZONE,
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }),
      )

      setTimelineWindow({
        start: currentMinutes,
        end: currentMinutes + 180,
      })
    }

    updateClock()
    const interval = window.setInterval(updateClock, 60_000)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (loading || !user) return

    void loadDashboardData()
    void logEvent(supabase, user.id, 'module_programme')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading])

  const loadDashboardData = async () => {
    if (!user) return

    try {
      const now = new Date()
      const todayString = formatParisDate(now)
      const parisWeekday = new Intl.DateTimeFormat('en-US', {
        timeZone: PARIS_TIME_ZONE,
        weekday: 'short',
      })
        .format(now)
        .toLowerCase()
        .slice(0, 3)

      const currentDayKey = DAY_KEYS.includes(parisWeekday)
        ? parisWeekday
        : DAY_KEYS[now.getDay()]

      const [
        noteRes,
        novaRes,
        eventsRes,
        routinesRes,
        todoRes,
        documentRes,
      ] = await Promise.all([
        supabase
          .from('notes')
          .select('content')
          .eq('user_id', user.id)
          .like('title', 'Objectif du%')
          .gte('created_at', `${todayString}T00:00:00`)
          .maybeSingle(),
        supabase
          .from('nova_pending_messages')
          .select('thread_id')
          .eq('user_id', user.id)
          .eq('is_read', false)
          .limit(1),
        supabase
          .from('planner_events')
          .select(
            'id, title, start_date, end_date, start_minutes, end_minutes, recurrence_days',
          )
          .eq('user_id', user.id)
          .order('start_date', { ascending: true }),
        supabase
          .from('routines')
          .select(
            'id, title, preferred_time, duration_minutes, frequency, custom_days',
          )
          .eq('user_id', user.id)
          .not('preferred_time', 'is', null),
        supabase
          .from('todo_list')
          .select('id, title, priority, status')
          .eq('user_id', user.id)
          .neq('status', 'done')
          .limit(4),
        supabase
          .from('administrative_documents')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ])

      if (noteRes.data?.content) {
        const lines = String(noteRes.data.content).split('\n')
        const savedIntention =
          lines
            .find((line) => line.startsWith('Intention :'))
            ?.replace('Intention : ', '') || ''
        const savedPriority =
          lines
            .find((line) => line.startsWith('Priorité n°1 :'))
            ?.replace('Priorité n°1 : ', '') || ''

        if (savedIntention || savedPriority) {
          setObjective({
            intention: savedIntention,
            priorite: savedPriority,
          })
        }
      }

      if (novaRes.data?.length) {
        setNovaPending({
          thread_id: novaRes.data[0].thread_id,
        })
      }

      setPriorityItems(
        (todoRes.data || []).map((item) => ({
          id: String(item.id),
          title: String(item.title),
          priority: item.priority,
        })),
      )

      if (!documentRes.error) {
        setDocumentCount(documentRes.count || 0)
      }

      const builtTimeline: TimelineItem[] = []

      for (const event of eventsRes.data || []) {
        const startDate = event.start_date
          ? String(event.start_date).split('T')[0]
          : todayString
        const endDate = event.end_date
          ? String(event.end_date).split('T')[0]
          : startDate
        const recurrenceDays = Array.isArray(event.recurrence_days)
          ? event.recurrence_days
          : []

        const appliesToday =
          recurrenceDays.length > 0
            ? recurrenceDays.includes(currentDayKey)
            : startDate <= todayString && endDate >= todayString

        if (!appliesToday) continue

        const startMinutes = event.start_minutes ?? 9 * 60
        const endMinutes = event.end_minutes ?? startMinutes + 60

        builtTimeline.push({
          id: `event-${event.id}`,
          title: String(event.title),
          startMinutes,
          endMinutes,
          kind: 'event',
        })
      }

      for (const routine of routinesRes.data || []) {
        const customDays = Array.isArray(routine.custom_days)
          ? routine.custom_days
          : typeof routine.custom_days === 'string'
            ? routine.custom_days
                .replace(/[{}]/g, '')
                .split(',')
                .map((day: string) => day.trim())
            : []

        const appliesToday =
          routine.frequency === 'daily' ||
          customDays.length === 0 ||
          customDays.length === 7 ||
          customDays.includes(currentDayKey)

        if (!appliesToday) continue

        const startMinutes = parseTimeToMinutes(
          routine.preferred_time,
        )
        const endMinutes =
          startMinutes + (routine.duration_minutes || 60)

        builtTimeline.push({
          id: `routine-${routine.id}`,
          title: String(routine.title),
          startMinutes,
          endMinutes,
          kind: 'routine',
        })
      }

      setTimeline(
        builtTimeline.sort(
          (first, second) =>
            first.startMinutes - second.startMinutes,
        ),
      )
    } catch (error) {
      console.error('[Home] dashboard load error', error)
    }
  }

  const upcomingTimeline = timeline.filter(
    (item) =>
      item.endMinutes >= timelineWindow.start &&
      item.startMinutes <= timelineWindow.end,
  )

  const openObjective = () => {
    if (objective) {
      setIntention(objective.intention)
      setPriorite(objective.priorite)
    }

    setShowObjective(true)
  }

  const saveObjective = async () => {
    if (!user || (!intention.trim() && !priorite.trim())) return

    setObjectiveLoading(true)

    try {
      const cleanIntention = intention.trim()
      const cleanPriority = priorite.trim()
      const now = new Date().toISOString()

      const { error: noteError } = await supabase
        .from('notes')
        .insert({
          user_id: user.id,
          content: `🎯 Objectif du jour\n\nIntention : ${cleanIntention}\nPriorité n°1 : ${cleanPriority}`,
          title: `Objectif du ${new Date().toLocaleDateString(
            'fr-FR',
            {
              timeZone: PARIS_TIME_ZONE,
              day: 'numeric',
              month: 'long',
            },
          )}`,
          created_at: now,
          updated_at: now,
        })

      if (noteError) throw noteError

      if (cleanPriority) {
        const { error: todoError } = await supabase
          .from('todo_list')
          .insert({
            user_id: user.id,
            title: cleanPriority,
            priority: 'high',
            status: 'pending',
            created_at: now,
            updated_at: now,
          })

        if (todoError) throw todoError
      }

      setObjective({
        intention: cleanIntention,
        priorite: cleanPriority,
      })
      setObjectiveSaved(true)

      window.setTimeout(() => {
        setShowObjective(false)
        setObjectiveSaved(false)
        setIntention('')
        setPriorite('')
        void loadDashboardData()
      }, 1200)
    } catch (error) {
      console.error('[Home] objective save error', error)
    } finally {
      setObjectiveLoading(false)
    }
  }

  const togglePrimaryModule = (moduleKey: string) => {
    setPrimaryModuleKeys((current) => {
      const selected = current.includes(moduleKey)
      const next = selected
        ? current.filter((key) => key !== moduleKey)
        : current.length < 3
          ? [...current, moduleKey]
          : current

      try {
        window.localStorage.setItem(
          MODULES_CACHE_KEY,
          JSON.stringify(next),
        )
      } catch {}

      return next
    })
  }

  return (
    <>
      {showModulePicker && (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowModulePicker(false)
            }
          }}
        >
          <div className="objective-modal">
            <div className="modal-header">
              <div>
                <span className="eyebrow">Accueil</span>
                <h2>Choisis tes 3 modules principaux</h2>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowModulePicker(false)}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <div className="module-picker-grid">
              {ALL_MODULES.map((module) => {
                const selected = primaryModuleKeys.includes(module.key)
                const disabled =
                  !selected && primaryModuleKeys.length >= 3

                return (
                  <button
                    key={module.key}
                    type="button"
                    className={`module-picker-item ${
                      selected ? 'selected' : ''
                    }`}
                    disabled={disabled}
                    aria-pressed={selected}
                    aria-label={`${module.title} — ${
                      selected
                        ? 'sélectionné'
                        : disabled
                          ? '3 modules déjà sélectionnés'
                          : 'ajouter aux modules principaux'
                    }`}
                    onClick={() => togglePrimaryModule(module.key)}
                  >
                    <span
                      className="secondary-space-icon"
                      style={{
                        flex: '0 0 48px',
                        background:
                          'linear-gradient(145deg, var(--novae-primary), var(--novae-hero-end))',
                        color: 'var(--novae-metal)',
                        borderColor: 'var(--novae-metal)',
                      }}
                    >
                      <PremiumIcon
                        name={module.icon}
                        width={25}
                        height={25}
                      />
                    </span>
                    <strong style={{ display: 'block', minWidth: 0 }}>
                      {module.title}
                    </strong>
                    <small>
                      {selected ? 'Sélectionné' : 'Ajouter'}
                    </small>
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              className="modal-primary"
              disabled={primaryModuleKeys.length !== 3}
              onClick={() => setShowModulePicker(false)}
            >
              Valider mes 3 modules
            </button>
          </div>
        </div>
      )}

      {showObjective && (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowObjective(false)
            }
          }}
        >
          <div className="objective-modal">
            {objectiveSaved ? (
              <div className="saved-state">
                <span className="saved-icon">
                  <PremiumIcon name="check" />
                </span>
                <h2>Objectif enregistré</h2>
                <p>Ta priorité est maintenant visible sur l’accueil.</p>
              </div>
            ) : (
              <>
                <div className="modal-header">
                  <div>
                    <span className="eyebrow">Aujourd’hui</span>
                    <h2>
                      {objective
                        ? 'Modifier ma priorité'
                        : 'Définir ma priorité'}
                    </h2>
                  </div>

                  <button
                    type="button"
                    className="close-button"
                    onClick={() => setShowObjective(false)}
                    aria-label="Fermer"
                  >
                    ×
                  </button>
                </div>

                <label className="field">
                  <span>Mon intention</span>
                  <input
                    value={intention}
                    onChange={(event) =>
                      setIntention(event.target.value)
                    }
                    placeholder="Ex. avancer sans m’éparpiller"
                  />
                </label>

                <label className="field">
                  <span>Ma priorité n°1</span>
                  <input
                    value={priorite}
                    onChange={(event) =>
                      setPriorite(event.target.value)
                    }
                    placeholder="Ex. terminer le dossier avant 14 h"
                  />
                </label>

                <button
                  type="button"
                  className="modal-primary"
                  onClick={() => void saveObjective()}
                  disabled={
                    objectiveLoading ||
                    (!intention.trim() && !priorite.trim())
                  }
                >
                  {objectiveLoading
                    ? 'Enregistrement…'
                    : 'Valider'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <main className="home-page">
        <header className="home-header">
          <div className="home-header-left">
            <NotificationBell />
          </div>

          <Link href="/" className="brand" aria-label="Accueil NOVAÉ">
            <span className="official-full-logo" aria-hidden="true" />
          </Link>

          <div className="header-actions">
            {!loading &&
              (user ? (
                <UserMenu />
              ) : (
                <Link href="/auth" className="login-link">
                  Se connecter
                </Link>
              ))}
          </div>
        </header>

        <div className="home-content">
          <section className="welcome">
            <div>
              <p className="date" suppressHydrationWarning>
                {dateLabel}
              </p>
              <h1 suppressHydrationWarning>
                {greeting}
                {pseudo ? (
                  <>
                    , <em>{pseudo}</em>
                  </>
                ) : null}
              </h1>
            </div>
          </section>

          <section className="nova-hero">
            <div className="hero-decoration" />

            <div className="hero-copy">
              <h2>
                <span>Qu’est-ce que je peux faire</span>
                <span>pour toi aujourd’hui ?</span>
              </h2>
            </div>

            <div className="nova-actions-row">
              <Link href="/nova-v2?voice=1" aria-label="Ouvrir Nova">
                <span className="hero-nova-monogram" aria-hidden="true" />
                <span className="sr-only">Nova</span>
              </Link>
            </div>
          </section>

          <Link
            href="/admin-documents"
            className="import-strip"
            style={{
              display: 'grid',
              width: '100%',
              minHeight: 68,
              gridTemplateColumns: '34px minmax(0, 1fr) 20px',
              gap: 14,
              alignItems: 'center',
              marginTop: 16,
              padding: '0 22px',
              color: 'var(--novae-text-main)',
              fontSize: 15,
              fontWeight: 700,
              textDecoration: 'none',
              background: 'var(--novae-surface)',
              border: '1px solid var(--novae-border)',
              borderRadius: 18,
              boxShadow: '0 10px 28px var(--novae-shadow)',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--novae-primary)',
              }}
            >
              <PremiumIcon name="upload" width={21} height={21} />
            </span>
            <span>Importer un contenu</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                color: 'var(--novae-primary)',
              }}
            >
              <PremiumIcon name="chevron" width={17} height={17} />
            </span>
          </Link>

          <section className="situation-section">
            <div className="section-heading">
              <h2>Ton point du jour</h2>
              <Link href="/planner">
                Voir tout
                <PremiumIcon name="chevron" width={17} height={17} />
              </Link>
            </div>

            <div className="next-hours-card point-day-card">
              <div className="card-heading">
                <span className="premium-circle">
                  <PremiumIcon name="clock" />
                </span>
                <div>
                  <strong>Les 3 prochaines heures</strong>
                  <small>
                    {timelineWindowLabel(
                      timelineWindow.start,
                      timelineWindow.end,
                    )}
                  </small>
                </div>
              </div>

              {upcomingTimeline.length > 0 ? (
                <div className="next-list">
                  {upcomingTimeline.slice(0, 3).map((item) => {
                    const inProgress =
                      item.startMinutes <= timelineWindow.start &&
                      item.endMinutes > timelineWindow.start

                    return (
                      <div key={item.id} className="next-item">
                        <span className="next-time">
                          {inProgress
                            ? `En cours · ${minutesToLabel(item.endMinutes)}`
                            : minutesToLabel(item.startMinutes)}
                        </span>
                        <div className="next-copy">
                          <strong>{item.title}</strong>
                          <small>
                            {item.kind === 'routine' ? 'Routine' : 'Planning'}
                          </small>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="calm-message">
                  <strong>Rien à signaler dans les 3 prochaines heures.</strong>
                  <p>Ton planning reste accessible avec « Voir tout ».</p>
                </div>
              )}
            </div>
          </section>

          <section className="modules-section">
            <div className="section-heading">
              <h2>Mes modules</h2>
              <button
                type="button"
                className="module-settings-button"
                onClick={() => setShowModulePicker(true)}
                aria-label="Choisir mes 3 modules principaux"
                title="Choisir mes 3 modules principaux"
              >
                <PremiumIcon
                  name="sliders"
                  width={19}
                  height={19}
                />
              </button>
            </div>

            <div className="home-primary-modules">
              {visiblePrimaryModules.map((module) => (
                <Link
                  key={module.key}
                  href={module.href}
                  className={`home-primary-module home-primary-${module.key}`}
                >
                  <span
                    className="home-primary-icon"
                    style={{
                      background:
                        'linear-gradient(145deg, var(--novae-primary), var(--novae-hero-end))',
                      color: 'var(--novae-metal)',
                      borderColor: 'var(--novae-metal)',
                    }}
                  >
                    <PremiumIcon
                      name={module.icon}
                      width={39}
                      height={39}
                    />
                  </span>

                  <span className="home-primary-label">{module.title}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="spaces-section">
            <button
              type="button"
              className="all-spaces-button"
              onClick={() =>
                setShowAllModules((current) => !current)
              }
              aria-expanded={showAllModules}
            >
              <span
                className="spaces-icon"
                style={{
                  background:
                    'linear-gradient(145deg, var(--novae-primary), var(--novae-hero-end))',
                  color: 'var(--novae-metal)',
                  borderColor: 'var(--novae-metal)',
                }}
              >
                <PremiumIcon name="grid" />
              </span>

              <span>
                <strong>Tous mes espaces</strong>
                <small>Accède à l’ensemble de tes espaces</small>
              </span>

              <PremiumIcon
                name="chevron"
                className={showAllModules ? 'rotate' : ''}
              />
            </button>

            {showAllModules && (
              <div className="other-modules">
                {visibleOtherModules.map((module) => (
                  <Link
                    key={module.key}
                    href={module.href}
                    className="secondary-space-link"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3ch',
                    }}
                  >
                    <span
                      className="secondary-space-icon"
                      style={{
                        flex: '0 0 48px',
                        background:
                          'linear-gradient(145deg, var(--novae-primary), var(--novae-hero-end))',
                        color: 'var(--novae-metal)',
                        borderColor: 'var(--novae-metal)',
                      }}
                    >
                      <PremiumIcon
                        name={module.icon}
                        width={25}
                        height={25}
                      />
                    </span>

                    <strong>{module.title}</strong>
                  </Link>
                ))}

                {isAdmin && (
                  <Link
                    href="/admin/pilotage"
                    className="secondary-space-link admin-dashboard-link"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3ch',
                    }}
                  >
                    <span
                      className="secondary-space-icon"
                      style={{
                        flex: '0 0 48px',
                        background:
                          'linear-gradient(145deg, var(--novae-primary), var(--novae-hero-end))',
                        color: 'var(--novae-metal)',
                        borderColor: 'var(--novae-metal)',
                      }}
                    >
                      <PremiumIcon
                        name="shield"
                        width={25}
                        height={25}
                      />
                    </span>

                    <strong style={{ display: 'block', minWidth: 0 }}>
                      Tableau de bord administrateur
                    </strong>
                  </Link>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
      <Navigation />

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        .home-page {
          min-height: 100dvh;
          padding-bottom: 105px;
          color: var(--novae-text-main);
          background:
            radial-gradient(
              circle at 86% 0%,
              color-mix(
                in srgb,
                var(--novae-primary-soft) 55%,
                transparent
              ),
              transparent 28%
            ),
            var(--novae-background);
          font-family: var(--novae-font-body);
        }

        :global(html[data-novae-preset='choice_4'])
          .home-page {
          background:
            linear-gradient(
              125deg,
              rgba(255, 255, 255, 0.018),
              transparent 45%
            ),
            repeating-linear-gradient(
              135deg,
              rgba(255, 255, 255, 0.018) 0 1px,
              transparent 1px 36px
            ),
            var(--novae-background);
        }

        .home-header {
          position: sticky;
          top: 0;
          z-index: 40;
          display: grid;
          min-height: 58px;
          grid-template-columns: minmax(80px, 1fr) auto minmax(80px, 1fr);
          align-items: center;
          padding: 6px 18px;
          background: color-mix(
            in srgb,
            var(--novae-background) 90%,
            transparent
          );
          border-bottom: 1px solid
            color-mix(
              in srgb,
              var(--novae-border) 72%,
              transparent
            );
          backdrop-filter: blur(18px);
        }

        .home-header-left {
          display: flex;
          min-width: 0;
          align-items: center;
          justify-content: flex-start;
        }

        .brand {
          display: flex;
          align-items: center;
          justify-self: center;
        }

        .official-full-logo {
          display: block;
          width: 136px;
          height: 36px;
          background: var(--novae-metal);
          -webkit-mask:
            url('/novae-logo-complet-mask.png')
            center / contain no-repeat;
          mask:
            url('/novae-logo-complet-mask.png')
            center / contain no-repeat;
        }

        .header-actions {
          display: flex;
          min-width: 0;
          align-items: center;
          justify-content: flex-end;
          gap: 9px;
        }

        .login-link {
          color: var(--novae-primary);
          font-size: 12px;
          font-weight: 900;
          text-decoration: none;
        }

        .home-content {
          width: min(100%, 980px);
          margin: 0 auto;
          padding: 18px 18px 46px;
        }

        .welcome {
          margin-bottom: 14px;
        }

        .date,
        .eyebrow {
          display: block;
          margin: 0 0 6px;
          color: var(--novae-metal);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .welcome h1 {
          margin: 0;
          font-family: var(--novae-font-title);
          font-size: clamp(34px, 6vw, 52px);
          font-weight: var(--novae-title-weight);
          line-height: 0.95;
          letter-spacing: var(--novae-title-letter-spacing);
        }

        .welcome h1 em {
          color: var(--novae-metal);
          font-style: normal;
          font-weight: inherit;
        }

        .nova-hero {
          position: relative;
          overflow: hidden;
          min-height: 190px;
          padding: 28px 34px 30px;
          color: var(--novae-hero-text);
          background:
            radial-gradient(
              circle at 87% 78%,
              color-mix(
                in srgb,
                var(--novae-metal) 48%,
                transparent
              ),
              transparent 22%
            ),
            linear-gradient(
              135deg,
              var(--novae-hero-start),
              var(--novae-hero-end)
            );
          border: 1px solid
            color-mix(
              in srgb,
              var(--novae-metal) 48%,
              transparent
            );
          border-radius: 28px;
          box-shadow: 0 22px 52px var(--novae-shadow);
        }

        .nova-hero::after {
          position: absolute;
          right: -12%;
          bottom: -33%;
          width: 62%;
          height: 58%;
          content: '';
          border: 1px solid
            color-mix(
              in srgb,
              var(--novae-metal) 58%,
              transparent
            );
          border-radius: 50%;
          box-shadow:
            0 -8px 32px
              color-mix(
                in srgb,
                var(--novae-metal) 35%,
                transparent
              ),
            inset 0 12px 36px
              color-mix(
                in srgb,
                var(--novae-metal) 20%,
                transparent
              );
          transform: rotate(-12deg);
        }

        .hero-decoration {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.65;
        }

        :global(html[data-novae-preset='choice_1'])
          .hero-decoration {
          background:
            radial-gradient(
              ellipse at 7% 8%,
              rgba(143, 165, 126, 0.34) 0 8%,
              transparent 9%
            ),
            radial-gradient(
              ellipse at 14% 17%,
              rgba(143, 165, 126, 0.24) 0 7%,
              transparent 8%
            ),
            radial-gradient(
              ellipse at 5% 29%,
              rgba(143, 165, 126, 0.2) 0 6%,
              transparent 7%
            );
        }

        :global(html[data-novae-preset='choice_2'])
          .hero-decoration,
        :global(html[data-novae-preset='choice_3'])
          .hero-decoration {
          background-image:
            radial-gradient(
              circle at 82% 20%,
              rgba(255, 255, 255, 0.38) 0 1px,
              transparent 2px
            ),
            radial-gradient(
              circle at 74% 35%,
              rgba(255, 255, 255, 0.2) 0 1px,
              transparent 2px
            ),
            radial-gradient(
              circle at 92% 45%,
              rgba(255, 255, 255, 0.25) 0 1px,
              transparent 2px
            );
        }

        .hero-copy {
          position: relative;
          z-index: 2;
          width: min(100%, 720px);
        }

        .hero-copy h2 {
          display: grid;
          gap: 2px;
          max-width: 650px;
          margin: 0;
          white-space: nowrap;
          font-family: var(--novae-font-title);
          font-size: clamp(26px, 4.3vw, 39px);
          font-weight: 500;
          line-height: 1.02;
        }

        .hero-copy p {
          max-width: 560px;
          margin: 15px 0 0;
          color: color-mix(
            in srgb,
            var(--novae-hero-text) 78%,
            transparent
          );
          font-size: 15px;
          line-height: 1.55;
        }
        :global(html[data-novae-preset='choice_4'])
          .hero-copy {
          width: min(56%, 500px);
        }

        :global(html[data-novae-preset='choice_4'])
          .hero-copy h2 {
          font-size: clamp(28px, 4.2vw, 43px);
          line-height: 0.98;
        }

        :global(html[data-novae-preset='choice_4'])
          .nova-hero {
          min-height: 338px;
        }



        .nova-actions-row {
          position: absolute;
          right: 50%;
          bottom: 18px;
          z-index: 3;
          display: grid;
          width: min(200px, calc(100% - 48px));
          transform: translateX(50%);
        }

        .nova-actions-row a {
          display: flex;
          min-height: 52px;
          align-items: center;
          justify-content: center;
          color: var(--novae-metal);
          text-decoration: none;
          background: color-mix(
            in srgb,
            var(--novae-primary) 94%,
            transparent
          );
          border: 1px solid var(--novae-metal);
          border-radius: 999px;
          box-shadow: 0 10px 24px color-mix(
            in srgb,
            var(--novae-shadow) 76%,
            transparent
          );
        }

        .hero-nova-monogram {
          display: block;
          width: 43px;
          height: 30px;
          background: var(--novae-metal);
          -webkit-mask:
            url('/nova-monogramme-no-mask.png')
            center / contain no-repeat;
          mask:
            url('/nova-monogramme-no-mask.png')
            center / contain no-repeat;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .import-strip {
          display: grid;
          width: 100%;
          min-height: 68px;
          grid-template-columns: 34px minmax(0, 1fr) 20px;
          gap: 14px;
          align-items: center;
          margin-top: 16px;
          padding: 0 22px;
          color: var(--novae-text-main);
          font-size: 15px;
          font-weight: 700;
          text-decoration: none;
          background: color-mix(
            in srgb,
            var(--novae-surface) 96%,
            transparent
          );
          border: 1px solid color-mix(
            in srgb,
            var(--novae-border) 94%,
            transparent
          );
          border-radius: 18px;
          box-shadow: 0 10px 28px color-mix(
            in srgb,
            var(--novae-shadow) 45%,
            transparent
          );
          backdrop-filter: blur(16px);
        }

        .import-strip:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 32px color-mix(
            in srgb,
            var(--novae-shadow) 58%,
            transparent
          );
        }

        .import-strip :global(svg:first-child),
        .import-strip :global(svg:last-child) {
          color: var(--novae-primary);
        }

        .import-strip :global(svg:last-child) {
          justify-self: end;
        }

        .point-day-card {
          display: grid;
          width: 100%;
          min-height: 0;
          grid-template-columns: minmax(210px, 0.85fr) minmax(0, 2.15fr);
          gap: 20px;
          align-items: center;
          padding: 20px 24px;
        }

        .point-day-card .card-heading {
          margin: 0;
        }

        .point-day-card .next-list {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0;
          margin: 0;
        }

        .point-day-card .next-item {
          min-height: 70px;
          grid-template-columns: 1fr;
          gap: 5px;
          align-content: center;
          padding: 8px 18px;
          border-bottom: 0;
          border-left: 1px solid var(--novae-border);
        }

        .point-day-card .next-time {
          font-size: 12px;
          font-weight: 900;
        }

        .point-day-card .next-copy small {
          margin-top: 3px;
        }

        .situation-section,
        .modules-section,
        .spaces-section {
          margin-top: 34px;
        }

        .section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 15px;
        }

        .section-heading h2 {
          margin: 0;
          font-family: var(--novae-font-title);
          font-size: clamp(27px, 4vw, 37px);
          font-weight: 500;
          line-height: 1;
        }

        .section-heading a {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--novae-primary);
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
        }

        .situation-cards,
        .dashboard-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(250px, 0.8fr);
          gap: 14px;
        }

        .next-hours-card,
        .priority-card,
        .timeline-dashboard,
        .priorities-dashboard,
        .metrics-card {
          color: var(--novae-text-main);
          background: var(--novae-surface);
          border: 1px solid var(--novae-border);
          border-radius: 22px;
          box-shadow: 0 13px 34px var(--novae-shadow);
        }

        .next-hours-card,
        .priority-card {
          min-height: 170px;
          padding: 18px;
        }

        .priority-card {
          display: flex;
          text-align: left;
          flex-direction: column;
          cursor: pointer;
        }

        .card-heading {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .card-heading > strong,
        .card-heading div > strong {
          display: block;
          font-family: var(--novae-font-title);
          font-size: 22px;
          font-weight: 500;
        }

        .card-heading small {
          display: block;
          margin-top: 3px;
          color: var(--novae-metal);
          font-size: 13px;
        }

        .premium-circle,
        .metric-icon,
        .dashboard-icon {
          display: inline-flex;
          flex: 0 0 48px;
          width: 54px;
          height: 54px;
          align-items: center;
          justify-content: center;
          color: var(--novae-metal);
          background: color-mix(
            in srgb,
            var(--novae-surface-alt) 85%,
            transparent
          );
          border: 1px solid
            color-mix(
              in srgb,
              var(--novae-metal) 60%,
              transparent
            );
          border-radius: 50%;
        }

        .calm-message,
        .priority-content {
          margin-top: auto;
          padding-top: 18px;
        }

        .calm-message strong,
        .priority-content > strong {
          display: block;
          font-family: var(--novae-font-title);
          font-size: 22px;
          font-weight: 500;
          line-height: 1.25;
        }

        .calm-message p,
        .priority-content p {
          margin: 7px 0 0;
          color: var(--novae-text-muted);
          font-size: 14px;
          line-height: 1.5;
        }

        .next-list {
          display: grid;
          gap: 0;
          margin-top: 14px;
        }

        .next-item {
          display: grid;
          grid-template-columns: minmax(118px, 138px) minmax(0, 1fr);
          gap: 16px;
          align-items: start;
          padding: 14px 0;
          border-top: 1px solid var(--novae-border);
        }

        .next-time {
          color: var(--novae-metal);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.02em;
        }

        .next-copy {
          min-width: 0;
        }

        .next-copy strong {
          display: block;
          font-size: 15px;
          line-height: 1.35;
        }

        .next-copy small {
          display: block;
          margin-top: 4px;
          color: var(--novae-text-muted);
          font-size: 11px;
        }

        .priority-badge {
          align-self: flex-start;
          margin-top: 19px;
          padding: 7px 10px;
          color: var(--novae-primary);
          background: var(--novae-primary-soft);
          border-radius: 7px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .metrics-card {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          padding: 24px 10px;
        }

        .metric {
          display: grid;
          color: inherit;
          text-decoration: none;
          min-height: 170px;
          place-items: center;
          align-content: center;
          padding: 18px;
          text-align: center;
          border-right: 1px solid var(--novae-border);
        }

        .metric:last-child {
          border-right: 0;
        }

        .metric strong {
          margin-top: 10px;
          font-family: var(--novae-font-title);
          font-size: 43px;
          font-weight: 500;
        }

        .metric small {
          max-width: 120px;
          margin-top: 5px;
          color: var(--novae-text-muted);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          line-height: 1.4;
          text-transform: uppercase;
        }

        .timeline-dashboard,
        .priorities-dashboard {
          overflow: hidden;
        }

        .dashboard-title {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 19px 20px 13px;
        }

        .dashboard-icon {
          flex-basis: 38px;
          width: 38px;
          height: 38px;
        }

        .dashboard-title strong {
          color: var(--novae-metal);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.11em;
          text-transform: uppercase;
        }

        .dashboard-list {
          display: grid;
          gap: 0;
          padding: 4px 20px 10px;
        }

        .dashboard-row {
          display: grid;
          grid-template-columns: 48px 10px 1fr;
          gap: 9px;
          align-items: start;
          min-height: 58px;
        }

        .dashboard-time {
          color: var(--novae-text-muted);
          font-size: 12px;
        }

        .dashboard-row > i {
          position: relative;
          width: 8px;
          height: 8px;
          margin-top: 4px;
          background: var(--novae-metal);
          border-radius: 50%;
        }

        .dashboard-row > i::after {
          position: absolute;
          top: 8px;
          left: 3px;
          width: 1px;
          height: 42px;
          content: '';
          background: var(--novae-border);
        }

        .dashboard-row:last-child > i::after {
          display: none;
        }

        .dashboard-row strong {
          display: block;
          font-size: 13px;
        }

        .dashboard-row small {
          display: block;
          margin-top: 3px;
          color: var(--novae-text-muted);
          font-size: 11px;
        }

        .nova-suggestion {
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr) auto 16px;
          gap: 12px;
          align-items: center;
          margin-top: 8px;
          padding: 14px 18px;
          color: var(--novae-text-main);
          text-decoration: none;
          background: color-mix(
            in srgb,
            var(--novae-primary-soft) 68%,
            var(--novae-surface)
          );
          border-top: 1px solid var(--novae-border);
        }

        .nova-suggestion-icon {
          display: inline-flex;
          width: 38px;
          height: 38px;
          align-items: center;
          justify-content: center;
          color: var(--novae-metal);
          background: color-mix(
            in srgb,
            var(--novae-surface) 88%,
            transparent
          );
          border: 1px solid
            color-mix(
              in srgb,
              var(--novae-metal) 40%,
              transparent
            );
          border-radius: 12px;
        }

        .nova-suggestion-copy {
          display: grid;
          min-width: 0;
        }

        .nova-suggestion-copy strong {
          font-size: 13px;
          font-weight: 800;
        }

        .nova-suggestion-copy small {
          margin-top: 2px;
          color: var(--novae-text-muted);
          font-size: 11px;
        }

        .nova-suggestion-cta {
          color: var(--novae-primary);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .nova-suggestion :global(svg:last-child) {
          color: var(--novae-primary);
        }

        .priority-list {
          display: grid;
          padding: 0 20px;
        }

        .priority-row {
          display: grid;
          grid-template-columns: 9px minmax(0, 1fr);
          gap: 12px;
          align-items: center;
          min-height: 59px;
          border-top: 1px solid var(--novae-border);
        }

        .priority-row i {
          width: 8px;
          height: 8px;
          background: color-mix(
            in srgb,
            var(--novae-primary) 52%,
            var(--novae-metal)
          );
          border-radius: 50%;
        }

        .priority-row i.high {
          background: var(--novae-metal);
        }

        .priority-row span {
          font-size: 13px;
          font-weight: 700;
        }

        .empty-priority {
          margin: 12px 0;
          padding: 15px;
          color: var(--novae-primary);
          background: transparent;
          border: 1px dashed var(--novae-border);
          border-radius: 12px;
          cursor: pointer;
        }

        .metrics-card-two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .module-settings-button {
          display: inline-flex;
          width: 38px;
          height: 38px;
          align-items: center;
          justify-content: center;
          color: var(--novae-primary);
          background: var(--novae-surface);
          border: 1px solid var(--novae-border);
          border-radius: 50%;
          cursor: pointer;
        }

        .module-picker-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          min-width: 0;
        }

        .module-picker-item {
          display: grid;
          min-width: 0;
          min-height: 78px;
          grid-template-columns: 48px minmax(0, 1fr);
          column-gap: 10px;
          row-gap: 2px;
          align-items: center;
          padding: 12px;
          color: var(--novae-text-main);
          text-align: left;
          background: var(--novae-surface);
          border: 1px solid var(--novae-border);
          border-radius: 14px;
          cursor: pointer;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }

        .module-picker-item.selected {
          border-color: var(--novae-metal);
          box-shadow: inset 0 0 0 1px var(--novae-metal);
        }

        .module-picker-item:focus-visible {
          outline: 3px solid
            color-mix(in srgb, var(--novae-metal) 45%, transparent);
          outline-offset: 2px;
        }

        .module-picker-item:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .module-picker-item .secondary-space-icon {
          grid-row: 1 / span 2;
          align-self: center;
        }

        .module-picker-item strong,
        .module-picker-item small {
          grid-column: 2;
          min-width: 0;
          max-width: 100%;
          overflow-wrap: anywhere;
          word-break: normal;
        }

        .module-picker-item strong {
          line-height: 1.15;
        }

        .module-picker-item small {
          color: var(--novae-text-muted);
          font-size: 10px;
          line-height: 1.25;
        }

        .all-spaces-button {
          display: grid;
          width: 100%;
          grid-template-columns: 58px 1fr 24px;
          gap: 22px;
          align-items: center;
          padding: 18px 22px;
          color: var(--novae-text-main);
          text-align: left;
          background: var(--novae-surface);
          border: 1px solid var(--novae-border);
          border-radius: 19px;
          box-shadow: 0 11px 30px var(--novae-shadow);
          cursor: pointer;
        }

        .spaces-icon {
          display: inline-flex;
          width: 52px;
          height: 52px;
          align-items: center;
          justify-content: center;
          color: var(--novae-metal);
          background: var(--novae-primary);
          border-radius: 50%;
        }

        .all-spaces-button > span:nth-child(2) {
          display: grid;
        }

        .all-spaces-button strong {
          font-family: var(--novae-font-title);
          font-size: 22px;
          font-weight: 500;
        }

        .all-spaces-button small {
          margin-top: 2px;
          color: var(--novae-text-muted);
          font-size: 11px;
        }

        .all-spaces-button :global(.rotate) {
          transform: rotate(90deg);
        }

        .home-primary-modules {
          display: grid;
          grid-template-columns: repeat(3, minmax(120px, 190px));
          gap: clamp(28px, 8vw, 110px);
          justify-content: center;
          align-items: start;
          width: 100%;
        }

        .home-primary-module {
          display: grid;
          min-width: 0;
          min-height: 118px;
          justify-items: center;
          align-content: center;
          gap: 10px;
          padding: 10px 8px;
          color: var(--novae-text-main);
          text-align: center;
          text-decoration: none;
          background: transparent;
          border: 0;
          border-radius: 20px;
          box-shadow: none;
          transition: transform 180ms ease;
        }

        .home-primary-module:hover {
          transform: translateY(-3px);
        }

        .home-primary-icon {
          display: inline-flex;
          width: 66px;
          height: 66px;
          align-items: center;
          justify-content: center;
          color: var(--novae-metal);
          background: linear-gradient(
            145deg,
            var(--novae-primary),
            var(--novae-hero-end)
          );
          border: 1px solid var(--novae-metal);
          border-radius: 17px;
          box-shadow:
            0 8px 20px color-mix(
              in srgb,
              var(--novae-primary) 26%,
              transparent
            ),
            inset 0 0 0 3px color-mix(
              in srgb,
              var(--novae-metal) 10%,
              transparent
            );
        }

        .home-primary-label {
          display: block;
          max-width: 100%;
          overflow: hidden;
          font-family: var(--novae-font-title);
          font-size: 17px;
          font-weight: 500;
          line-height: 1.1;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        :global(html[data-novae-preset='choice_3'])
          .home-primary-icon {
          color: var(--novae-metal);
          background: var(--novae-surface-alt);
          border-color: color-mix(
            in srgb,
            var(--novae-metal) 55%,
            transparent
          );
        }

        .other-modules {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          column-gap: clamp(56px, 10vw, 150px);
          row-gap: 20px;
          margin-top: 22px;
          padding: 8px 22px 18px;
        }

        .secondary-space-link {
          display: grid;
          min-width: 0;
          grid-template-columns: 58px minmax(0, 1fr);
          column-gap: 34px;
          align-items: center;
          padding: 12px 0;
          color: var(--novae-text-main);
          text-decoration: none;
          background: transparent;
          border: 0;
          border-radius: 16px;
          box-shadow: none;
        }

        .admin-dashboard-link {
          grid-column: 1 / -1;
          width: 100%;
          margin-top: 6px;
          padding: 16px 18px;
        }

        .admin-dashboard-link > strong {
          white-space: normal;
        }

        .secondary-space-icon {
          display: inline-flex;
          width: 48px;
          height: 48px;
          align-items: center;
          justify-content: center;
          color: var(--novae-metal);
          background: linear-gradient(
            145deg,
            var(--novae-primary),
            var(--novae-hero-end)
          );
          border: 1px solid
            color-mix(
              in srgb,
              var(--novae-metal) 70%,
              transparent
            );
          border-radius: 14px;
        }

        .secondary-space-link > strong {
          display: block;
          min-width: 0;
          padding-left: 4px;
          overflow: hidden;
          font-family: var(--novae-font-title);
          font-size: 17px;
          font-weight: 600;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(0, 0, 0, 0.48);
          backdrop-filter: blur(8px);
        }

        .objective-modal {
          width: min(100%, 520px);
          max-height: min(
            860px,
            calc(
              100dvh -
              env(safe-area-inset-top, 0px) -
              env(safe-area-inset-bottom, 0px) -
              24px
            )
          );
          overflow-y: auto;
          overscroll-behavior: contain;
          padding: 24px;
          padding-bottom: max(24px, env(safe-area-inset-bottom, 0px));
          color: var(--novae-text-main);
          background: var(--novae-surface);
          border: 1px solid var(--novae-border);
          border-radius: 24px;
          box-shadow: 0 28px 70px rgba(0, 0, 0, 0.24);
          -webkit-overflow-scrolling: touch;
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
        }

        .modal-header h2,
        .saved-state h2 {
          margin: 0;
          font-family: var(--novae-font-title);
          font-size: 34px;
          font-weight: 500;
        }

        .close-button {
          width: 44px;
          height: 44px;
          flex: 0 0 44px;
          color: var(--novae-text-main);
          background: var(--novae-surface-alt);
          border: 1px solid var(--novae-border);
          border-radius: 50%;
          cursor: pointer;
        }

        .field {
          display: grid;
          gap: 7px;
          margin-top: 14px;
        }

        .field span {
          color: var(--novae-primary);
          font-size: 12px;
          font-weight: 900;
        }

        .field input {
          width: 100%;
          padding: 13px 14px;
          color: var(--novae-text-main);
          background: var(--novae-background);
          border: 1px solid var(--novae-border);
          border-radius: 12px;
          outline: none;
        }

        .modal-primary {
          width: 100%;
          margin-top: 20px;
          padding: 14px;
          color: var(--novae-background);
          background: var(--novae-primary);
          border: 0;
          border-radius: 13px;
          font-weight: 900;
          cursor: pointer;
        }

        .saved-state {
          display: grid;
          place-items: center;
          padding: 25px 10px;
          text-align: center;
        }

        .saved-state p {
          color: var(--novae-text-muted);
        }

        .saved-icon {
          display: inline-flex;
          width: 62px;
          height: 62px;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          color: var(--novae-success);
          background: var(--novae-primary-soft);
          border-radius: 50%;
        }

        @media (max-width: 760px) {
          .home-content {
            padding-right: 14px;
            padding-left: 14px;
          }

          .nova-hero {
            min-height: 285px;
            padding: 28px 23px;
          }

          .hero-copy {
            width: 100%;
            padding-right: 0;
          }

          .hero-copy h2 {
            max-width: 92%;
            font-size: 34px;
          }

          :global(html[data-novae-preset='choice_4'])
            .hero-copy h2 {
            max-width: 60%;
            font-size: 30px;
          }

          :global(html[data-novae-preset='choice_4'])
            .nova-hero {
            min-height: 300px;
          }


          .nova-actions-row {
            right: 50%;
            bottom: 18px;
            left: auto;
            width: min(200px, calc(100% - 48px));
            transform: translateX(50%);
          }

          .nova-actions-row a {
            width: 100%;
            min-height: 52px;
            align-items: center;
            justify-content: center;
          }

          .situation-cards,
          .dashboard-grid {
            grid-template-columns: 1fr;
          }

          .module-card {
            min-height: 160px;
          }

          .module-icon-box {
            width: 66px;
            height: 66px;
          }

          .module-card > strong {
            font-size: 19px;
          }
        }

        @media (max-width: 900px) {
          .home-primary-modules {
            width: min(100%, 620px);
            grid-template-columns: repeat(3, minmax(110px, 1fr));
            gap: 18px;
            margin-inline: auto;
            justify-content: center;
          }

          .home-primary-module {
            min-height: 165px;
            padding: 16px 8px;
          }

          .home-primary-icon {
            width: 70px;
            height: 70px;
            border-radius: 18px;
          }

          .home-primary-label {
            font-size: 17px;
          }
        }

        @media (max-width: 640px) {
          .home-primary-modules {
            width: min(100%, 560px);
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
            margin-inline: auto;
            justify-content: center;
          }

          .home-primary-module {
            min-height: 126px;
            gap: 9px;
            padding: 12px 5px;
            border-radius: 17px;
          }

          .home-primary-icon {
            width: 55px;
            height: 55px;
            border-radius: 15px;
          }

          .home-primary-icon :global(svg) {
            width: 28px;
            height: 28px;
          }

          .home-primary-label {
            font-size: 14px;
          }

          .other-modules {
            grid-template-columns: 1fr;
          }
        }


        @media (max-width: 640px) {
          .next-item {
            grid-template-columns: 1fr;
            gap: 6px;
          }

          .next-time {
            font-size: 11px;
          }

          .nova-suggestion {
            grid-template-columns: 38px minmax(0, 1fr) 14px;
          }

          .nova-suggestion-cta {
            display: none;
          }

          .secondary-space-link {
            column-gap: 26px;
          }
        }

        @media (max-width: 520px) {
          .home-header {
            min-height: 54px;
            grid-template-columns: 52px minmax(98px, 1fr) auto;
            padding: 5px 10px;
          }

          .official-full-logo {
            width: 110px;
            height: 31px;
          }

          .welcome h1 {
            font-size: 37px;
          }

          .nova-hero {
            min-height: 178px;
            padding: 22px 20px 70px;
          }

          .hero-copy h2 {
            max-width: 100%;
            font-size: 27px;
            white-space: normal;
          }

          .hero-copy h2 span {
            display: inline;
          }

          .hero-copy h2 span:first-child::after {
            content: ' ';
          }

          :global(html[data-novae-preset='choice_4'])
            .hero-copy h2 {
            max-width: 58%;
            font-size: 26px;
          }

          :global(html[data-novae-preset='choice_4'])
            .nova-hero {
            min-height: 315px;
          }

          .hero-copy p {
            max-width: 70%;
            font-size: 12px;
          }



          .nova-actions-row a span {
            font-size: 13px;
          }

          .nova-actions-row a :global(svg) {
            width: 19px;
            height: 19px;
          }

          .point-day-card {
            grid-template-columns: 1fr;
            gap: 14px;
          }

          .point-day-card .next-list {
            grid-template-columns: 1fr;
          }

          .point-day-card .next-item {
            grid-template-columns: 70px minmax(0, 1fr);
            border-left: 0;
            border-top: 1px solid var(--novae-border);
          }

          .home-primary-modules {
            width: 100%;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
            margin-inline: auto;
            justify-content: center;
          }

          .home-primary-module {
            min-height: 104px;
            padding: 8px 4px;
          }

          .home-primary-icon {
            width: 56px;
            height: 56px;
          }

          .metrics-card {
            padding: 12px 4px;
          }

          .metric {
            min-height: 145px;
            padding: 10px 4px;
          }

          .metric-icon {
            width: 42px;
            height: 42px;
          }

          .metric strong {
            font-size: 34px;
          }

          .metric small {
            font-size: 8px;
          }

          .module-grid {
            gap: 8px;
          }

          .module-card {
            min-height: 145px;
            padding: 14px 7px;
          }

          .module-icon-box {
            width: 58px;
            height: 58px;
            margin-bottom: 11px;
            border-radius: 16px;
          }

          .module-icon-box :global(svg) {
            width: 30px;
            height: 30px;
          }

          .module-card > strong {
            font-size: 16px;
          }

          .module-card > small {
            display: none;
          }

          .all-spaces-button {
            grid-template-columns: 43px 1fr 21px;
            padding: 13px;
          }

          .spaces-icon {
            width: 39px;
            height: 39px;
          }

          .all-spaces-button strong {
            font-size: 18px;
          }

          .other-modules {
            grid-template-columns: 1fr;
          }
        }

        /* Production-safe alignment: must stay last so responsive preset rules
           cannot move the validated home controls. */
        .nova-actions-row {
          right: 50% !important;
          left: auto !important;
          width: min(200px, calc(100% - 48px)) !important;
          transform: translateX(50%) !important;
        }

        .nova-actions-row a {
          width: 100% !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .hero-nova-monogram {
          margin-inline: auto !important;
        }

        .home-primary-modules {
          margin-inline: auto !important;
          justify-content: center !important;
        }

        .home-primary-module {
          justify-self: center !important;
        }


        /* Stabilisation store-ready du sélecteur de modules.
           Les libellés longs restent contenus et les cibles tactiles
           restent utilisables sur téléphone étroit / Fold fermé. */
        @media (max-width: 520px) {
          .modal-backdrop {
            place-items: end center;
            padding:
              max(10px, env(safe-area-inset-top, 0px))
              10px
              max(10px, env(safe-area-inset-bottom, 0px));
          }

          .objective-modal {
            width: 100%;
            max-height: calc(
              100dvh -
              env(safe-area-inset-top, 0px) -
              env(safe-area-inset-bottom, 0px) -
              20px
            );
            padding: 18px 14px
              max(18px, env(safe-area-inset-bottom, 0px));
            border-radius: 22px;
          }

          .modal-header {
            gap: 10px;
            margin-bottom: 14px;
          }

          .modal-header h2,
          .saved-state h2 {
            font-size: clamp(25px, 8vw, 31px);
            line-height: 1;
          }

          .module-picker-grid {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .module-picker-item {
            min-height: 68px;
            grid-template-columns: 44px minmax(0, 1fr);
            padding: 10px 12px;
          }

          .module-picker-item .secondary-space-icon {
            width: 44px !important;
            height: 44px !important;
            flex-basis: 44px !important;
          }

          .module-picker-item strong {
            font-size: 15px;
          }

          .modal-primary {
            position: sticky;
            bottom: 0;
            z-index: 2;
            min-height: 48px;
            margin-top: 14px;
            box-shadow: 0 -8px 18px
              color-mix(in srgb, var(--novae-surface) 88%, transparent);
          }
        }

        @media (max-width: 360px) {
          .objective-modal {
            padding-right: 10px;
            padding-left: 10px;
          }

          .module-picker-item {
            grid-template-columns: 42px minmax(0, 1fr);
            column-gap: 9px;
          }

          .module-picker-item .secondary-space-icon {
            width: 42px !important;
            height: 42px !important;
            flex-basis: 42px !important;
          }

          .module-picker-item strong {
            font-size: 14px;
          }
        }

      `}</style>
    </>
  )
}