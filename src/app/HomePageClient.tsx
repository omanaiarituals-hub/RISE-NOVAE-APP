// src/app/HomePageClient.tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import NotificationBell from '@/components/NotificationBell'
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
  { key: 'family', href: '/family', title: 'Famille', description: 'Informations du foyer', icon: 'family' },
  { key: 'routines', href: '/routines', title: 'Routines', description: 'Habitudes du quotidien', icon: 'routine' },
  { key: 'tracker', href: '/tracker', title: 'Suivi', description: 'Tes indicateurs', icon: 'tracker' },
]

const DEFAULT_PRIMARY_MODULE_KEYS = ['planner', 'todo', 'meals']
const MODULES_CACHE_KEY = 'novae-primary-modules'

const OTHER_MODULES: ModuleItem[] = [
  { key: 'astuces', href: '/astuces', title: 'Astuces', description: 'Conseils pratiques', icon: 'idea' },
  { key: 'blog', href: '/blog', title: 'Ressources', description: 'Articles et contenus', icon: 'book' },
  { key: 'finance', href: '/settings', title: 'Finances', description: 'Bientôt disponible', icon: 'wallet' },
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

    const checkOnboarding = async () => {
      const { data } = await supabase
        .from('ai_personality_profile')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!data) router.push('/onboarding')
    }

    void checkOnboarding()
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
                    onClick={() => togglePrimaryModule(module.key)}
                  >
                    <span className="secondary-space-icon">
                      <PremiumIcon
                        name={module.icon}
                        width={25}
                        height={25}
                      />
                    </span>
                    <strong>{module.title}</strong>
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
          <Link href="/" className="brand" aria-label="Accueil NOVAÉ">
            <span className="official-full-logo" aria-hidden="true" />
          </Link>

          <div className="header-actions">
            <NotificationBell />
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
                Qu’est-ce que je peux faire pour toi aujourd’hui ?
              </h2>
            </div>

            <div className="nova-actions-row">
              <Link href="/nova-v2?voice=1">
                <PremiumIcon name="sparkle" width={23} height={23} />
                <span>Nova</span>
              </Link>

              <Link href="/admin-documents">
                <PremiumIcon name="upload" width={23} height={23} />
                <span>Importer</span>
              </Link>
            </div>
          </section>

          <section className="situation-section">
            <div className="section-heading">
              <h2>Ton point de situation</h2>
              <Link href="/planner">
                Voir tout
                <PremiumIcon
                  name="chevron"
                  width={17}
                  height={17}
                />
              </Link>
            </div>

            {pointMode === 'metrics' ? (
              <div className="metrics-card metrics-card-two">
                <Link href="/planner" className="metric">
                  <span className="metric-icon">
                    <PremiumIcon name="calendar" />
                  </span>
                  <strong>{timeline.length}</strong>
                  <small>Événements aujourd’hui</small>
                </Link>

                <Link href="/todo" className="metric">
                  <span className="metric-icon">
                    <PremiumIcon name="check" />
                  </span>
                  <strong>{priorityItems.length}</strong>
                  <small>Tâches en cours</small>
                </Link>
              </div>
            ) : pointMode === 'timeline' ? (
              <div className="dashboard-grid">
                <div className="timeline-dashboard">
                  <div className="dashboard-title">
                    <span className="dashboard-icon">
                      <PremiumIcon name="calendar" />
                    </span>
                    <strong>Aujourd’hui</strong>
                  </div>

                  <div className="dashboard-list">
                    {(timeline.length > 0
                      ? timeline.slice(0, 4)
                      : [
                          {
                            id: 'empty',
                            title: 'Aucun rendez-vous prévu',
                            startMinutes: timelineWindow.start,
                            endMinutes: timelineWindow.start,
                            kind: 'event' as const,
                          },
                        ]
                    ).map((item) => (
                      <div key={item.id} className="dashboard-row">
                        <span className="dashboard-time">
                          {minutesToLabel(item.startMinutes)}
                        </span>
                        <i />
                        <div>
                          <strong>{item.title}</strong>
                          <small>
                            {item.id === 'empty'
                              ? 'Ta journée est disponible'
                              : item.kind === 'routine'
                                ? 'Routine'
                                : 'Planning'}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="priorities-dashboard">
                  <div className="dashboard-title">
                    <span className="dashboard-icon">
                      <PremiumIcon name="flag" />
                    </span>
                    <strong>Priorités</strong>
                  </div>

                  <div className="priority-list">
                    {[
                      ...(objective?.priorite
                        ? [
                            {
                              id: 'objective',
                              title: objective.priorite,
                              priority: 'high',
                            },
                          ]
                        : []),
                      ...priorityItems,
                    ]
                      .slice(0, 3)
                      .map((item) => (
                        <div key={item.id} className="priority-row">
                          <i
                            className={
                              item.priority === 'high'
                                ? 'high'
                                : ''
                            }
                          />
                          <span>{item.title}</span>
                        </div>
                      ))}

                    {!objective?.priorite &&
                      priorityItems.length === 0 && (
                        <button
                          type="button"
                          className="empty-priority"
                          onClick={openObjective}
                        >
                          Définir ma première priorité
                        </button>
                      )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="situation-cards">
                <div className="next-hours-card">
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
                          item.startMinutes <=
                            timelineWindow.start &&
                          item.endMinutes > timelineWindow.start

                        return (
                          <div
                            key={item.id}
                            className="next-item"
                          >
                            <span className="next-time">
                              {inProgress
                                ? `En cours jusqu’à ${minutesToLabel(
                                    item.endMinutes,
                                  )}`
                                : `${minutesToLabel(
                                    item.startMinutes,
                                  )} – ${minutesToLabel(
                                    item.endMinutes,
                                  )}`}
                            </span>

                            <div className="next-copy">
                              <strong>{item.title}</strong>
                              <small>
                                {inProgress
                                  ? 'En cours'
                                  : item.kind === 'routine'
                                    ? 'Routine'
                                    : 'Événement'}
                              </small>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="calm-message">
                      <strong>Soirée plus calme à venir.</strong>
                      <p>Parfait pour avancer sereinement.</p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="priority-card"
                  onClick={openObjective}
                >
                  <div className="card-heading">
                    <span className="premium-circle">
                      <PremiumIcon name="flag" />
                    </span>
                    <strong>Priorité</strong>
                  </div>

                  <div className="priority-content">
                    <strong>
                      {objective?.priorite ||
                        'Choisis ce qui compte aujourd’hui.'}
                    </strong>
                    {objective?.intention && (
                      <p>{objective.intention}</p>
                    )}
                  </div>

                  <span className="priority-badge">
                    {objective?.priorite
                      ? 'Haute priorité'
                      : 'Définir'}
                  </span>
                </button>
              </div>
            )}
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
                  <span className="home-primary-icon">
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
              <span className="spaces-icon">
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
                  >
                    <span className="secondary-space-icon">
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
                  >
                    <span className="secondary-space-icon">
                      <PremiumIcon
                        name="shield"
                        width={25}
                        height={25}
                      />
                    </span>

                    <strong>Tableau de bord administrateur</strong>
                  </Link>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

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
          display: flex;
          min-height: 68px;
          align-items: center;
          justify-content: space-between;
          padding: 9px 22px;
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

        .brand {
          display: flex;
          align-items: center;
        }

        .official-full-logo {
          display: block;
          width: 156px;
          height: 45px;
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
          align-items: center;
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
          padding: 27px 18px 46px;
        }

        .welcome {
          margin-bottom: 20px;
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
          font-size: clamp(39px, 7vw, 61px);
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
          min-height: 235px;
          padding: clamp(28px, 5vw, 45px);
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
          margin: 0;
          font-family: var(--novae-font-title);
          font-size: clamp(32px, 5vw, 49px);
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
          z-index: 3;
          bottom: 22px;
          left: 50%;
          display: grid;
          width: min(520px, calc(100% - 48px));
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
          transform: translateX(-50%);
        }

        .hero-actions a {
          display: flex;
          min-height: 58px;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: var(--novae-hero-text);
          font-family: var(--novae-font-title);
          font-size: 19px;
          text-decoration: none;
          background: color-mix(
            in srgb,
            var(--novae-hero-end) 68%,
            transparent
          );
          border: 1px solid
            color-mix(
              in srgb,
              var(--novae-metal) 55%,
              transparent
            );
          border-radius: 15px;
          backdrop-filter: blur(10px);
        }

        .nova-actions-row a {
          display: flex;
          width: 100%;
          min-height: 52px;
          align-items: center;
          justify-content: center;
          gap: 9px;
          color: var(--novae-hero-text);
          font-family: var(--novae-font-title);
          font-size: 18px;
          text-decoration: none;
          background: color-mix(
            in srgb,
            var(--novae-hero-end) 68%,
            transparent
          );
          border: 1px solid
            color-mix(
              in srgb,
              var(--novae-metal) 55%,
              transparent
            );
          border-radius: 15px;
          backdrop-filter: blur(10px);
        }

        .nova-actions-row a :global(svg) {
          color: var(--novae-metal);
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
          width: 48px;
          height: 48px;
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
        }

        .module-picker-item {
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
          padding: 12px;
          color: var(--novae-text-main);
          text-align: left;
          background: var(--novae-surface);
          border: 1px solid var(--novae-border);
          border-radius: 14px;
          cursor: pointer;
        }

        .module-picker-item.selected {
          border-color: var(--novae-metal);
          box-shadow: inset 0 0 0 1px var(--novae-metal);
        }

        .module-picker-item:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .module-picker-item strong,
        .module-picker-item small {
          grid-column: 2;
        }

        .module-picker-item small {
          color: var(--novae-text-muted);
          font-size: 10px;
        }

        .all-spaces-button {
          display: grid;
          width: 100%;
          grid-template-columns: 50px 1fr 24px;
          gap: 13px;
          align-items: center;
          padding: 15px 18px;
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
          width: 46px;
          height: 46px;
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
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .home-primary-module {
          display: grid;
          min-width: 0;
          min-height: 190px;
          justify-items: center;
          align-content: center;
          gap: 14px;
          padding: 20px 12px;
          color: var(--novae-text-main);
          text-align: center;
          text-decoration: none;
          background: var(--novae-surface);
          border: 1px solid var(--novae-border);
          border-radius: 22px;
          box-shadow: 0 12px 32px var(--novae-shadow);
          transition:
            transform 180ms ease,
            box-shadow 180ms ease;
        }

        .home-primary-module:hover {
          transform: translateY(-4px);
          box-shadow: 0 18px 38px var(--novae-shadow);
        }

        .home-primary-icon {
          display: inline-flex;
          width: 84px;
          height: 84px;
          align-items: center;
          justify-content: center;
          color: var(--novae-metal);
          background: linear-gradient(
            145deg,
            var(--novae-primary),
            var(--novae-hero-end)
          );
          border: 1px solid var(--novae-metal);
          border-radius: 20px;
          box-shadow:
            0 8px 20px
              color-mix(
                in srgb,
                var(--novae-primary) 28%,
                transparent
              ),
            inset 0 0 0 3px
              color-mix(
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
          font-size: 20px;
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
          gap: 12px;
          margin-top: 12px;
        }

        .secondary-space-link {
          display: grid;
          min-width: 0;
          grid-template-columns: 48px minmax(0, 1fr);
          gap: 20px;
          align-items: center;
          padding: 14px 16px;
          color: var(--novae-text-main);
          text-decoration: none;
          background: var(--novae-surface);
          border: 1px solid var(--novae-border);
          border-radius: 16px;
          box-shadow: 0 8px 22px var(--novae-shadow);
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
          overflow: hidden;
          font-size: 14px;
          font-weight: 800;
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
          padding: 24px;
          color: var(--novae-text-main);
          background: var(--novae-surface);
          border: 1px solid var(--novae-border);
          border-radius: 24px;
          box-shadow: 0 28px 70px rgba(0, 0, 0, 0.24);
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
          width: 36px;
          height: 36px;
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
            bottom: 18px;
            width: calc(100% - 36px);
            gap: 8px;
          }

          .nova-actions-row a {
            min-height: 52px;
            gap: 6px;
            font-size: 16px;
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
            gap: 12px;
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
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
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
            gap: 16px;
          }
        }

        @media (max-width: 520px) {
          .home-header {
            min-height: 60px;
            padding: 7px 14px;
          }

          .official-full-logo {
            width: 136px;
            height: 39px;
          }

          .welcome h1 {
            font-size: 41px;
          }

          .hero-copy h2 {
            font-size: 30px;
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
      `}</style>
    </>
  )
}
