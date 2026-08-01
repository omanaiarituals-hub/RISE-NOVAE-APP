import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createNovaActionPlan } from '@/lib/nova-ai/router'
import {
  NOVA_PROVIDER_IDS,
  type NovaActionPlan,
  type NovaProviderPreference,
} from '@/lib/nova-ai/types'
import { rateLimit } from '@/lib/rateLimit'
import { createNovaExecutionToken } from '@/lib/nova-ai/action-token'
import {
  findBestTaskMatches,
  findLikelyDuplicatePairs,
  type TaskIdentityComparison,
} from '@/lib/nova-ai/task-identity'
import {
  findBestCalendarMatches,
  type CalendarIdentityMatch,
} from '@/lib/nova-ai/calendar-identity'

export const runtime = 'nodejs'
export const maxDuration = 30

type ActiveTaskContextRow = {
  id: string
  title: string
  description: string | null
  category: string | null
  due_date: string | null
  due_time: string | null
  status: string
  created_at: string
}

type ActiveCalendarContextRow = {
  id: string
  title: string
  start_date: string
  end_date: string
  location: string | null
  attendees: string[] | null
  status: string | null
  reminder_minutes_before: number[] | null
}

type ActiveReminderContextRow = {
  id: string
  todo_id: string
  scheduled_for: string
  status: string
  message: string | null
}

type DuplicateTaskPair = {
  left: ActiveTaskContextRow
  right: ActiveTaskContextRow
  comparison: TaskIdentityComparison
}

type RequestTaskMatch = {
  task: ActiveTaskContextRow
  comparison: TaskIdentityComparison
}

type RequestCalendarMatch = CalendarIdentityMatch

function actionStartsTitle(title: string): boolean {
  const normalized = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  return /^(envoyer|contacter|appeler|payer|regler|acheter|reserver|prendre|verifier|transmettre|deposer)\b/.test(
    normalized
  )
}

function chooseTaskToKeep(left: ActiveTaskContextRow, right: ActiveTaskContextRow) {
  const leftScore =
    (actionStartsTitle(left.title) ? 3 : 0) +
    (left.due_date ? 2 : 0) +
    (left.description ? 1 : 0) +
    Math.min(2, left.title.trim().split(/\s+/).length / 4)
  const rightScore =
    (actionStartsTitle(right.title) ? 3 : 0) +
    (right.due_date ? 2 : 0) +
    (right.description ? 1 : 0) +
    Math.min(2, right.title.trim().split(/\s+/).length / 4)

  if (leftScore !== rightScore) return leftScore > rightScore ? left : right
  return new Date(left.created_at).getTime() <= new Date(right.created_at).getTime()
    ? left
    : right
}

function applyTaskIdentityGuard(
  plan: NovaActionPlan,
  message: string,
  duplicatePairs: DuplicateTaskPair[],
  requestMatches: RequestTaskMatch[]
): NovaActionPlan {
  const planContainsMerge = plan.proposed_actions.some(
    (action) => action.type === 'merge_tasks'
  )

  // Le modèle de langage peut soupçonner un doublon, mais il ne doit jamais
  // produire une fusion exécutable sans validation déterministe côté NOVAÉ.
  if (duplicatePairs.length === 0) {
    if (!planContainsMerge) return plan
    return {
      ...plan,
      summary: 'Une proximité a été repérée, mais elle n’est pas encore assez fiable.',
      missing_information: [
        {
          field: 'task_duplicate_confirmation',
          question:
            'Ces tâches semblent proches, mais Nova ne peut pas encore confirmer qu’il s’agit de la même action. Souhaites-tu les conserver séparément ?',
          blocking: true,
        },
      ],
      proposed_actions: [],
      assistant_message:
        'J’ai repéré une ressemblance entre ces tâches, mais pas assez pour proposer une fusion sécurisée. Je les laisse séparées pour le moment.',
    }
  }

  const explicitMergeRequest = /\b(fusionne|fusionner|doublon|meme tache|même tâche|identique)\b/i.test(
    message
  )
  const matchThreshold = explicitMergeRequest ? 0.25 : 0.45
  const topMatchIds = new Set(
    requestMatches
      .filter(({ comparison }) => comparison.score >= matchThreshold)
      .slice(0, 5)
      .map(({ task }) => task.id)
  )
  const planTouchesTasks = plan.proposed_actions.some((action) =>
    ['create_task', 'create_reminder', 'merge_tasks'].includes(action.type)
  )

  const relevantPair =
    duplicatePairs.find(({ left, right }) => {
      const bothMatch = topMatchIds.has(left.id) && topMatchIds.has(right.id)
      const oneMatch = topMatchIds.has(left.id) || topMatchIds.has(right.id)
      return bothMatch || (explicitMergeRequest && oneMatch)
    }) ||
    (explicitMergeRequest && duplicatePairs.length === 1 ? duplicatePairs[0] : undefined)

  if (!relevantPair || (!explicitMergeRequest && !planTouchesTasks)) {
    if (!planContainsMerge) return plan
    return {
      ...plan,
      summary: 'Aucune paire de tâches suffisamment fiable n’a été identifiée.',
      missing_information: [],
      proposed_actions: [],
      assistant_message:
        'Je ne peux pas relier ces tâches avec assez de certitude pour proposer une fusion. Je les conserve séparément.',
    }
  }

  const { left, right, comparison } = relevantPair
  if (
    left.due_date &&
    right.due_date &&
    left.due_date !== right.due_date
  ) {
    return {
      ...plan,
      summary: `Deux tâches similaires ont été trouvées, mais leurs échéances sont différentes.`,
      missing_information: [
        {
          field: 'task_duplicate_dates',
          question: `Les tâches « ${left.title} » et « ${right.title} » semblent proches, mais leurs échéances diffèrent. S’agit-il vraiment de la même démarche ?`,
          blocking: true,
        },
      ],
      proposed_actions: [],
      assistant_message: `J’ai trouvé deux tâches très proches, mais elles n’ont pas la même échéance. Dis-moi si elles correspondent réellement à la même démarche avant que je propose une fusion.`,
    }
  }

  const keep = chooseTaskToKeep(left, right)
  const duplicate = keep.id === left.id ? right : left

  return {
    ...plan,
    summary: `Deux tâches semblent correspondre à la même action (${Math.round(
      comparison.score * 100
    )} % de similarité).`,
    missing_information: [],
    proposed_actions: [
      {
        id: 'merge_tasks_1',
        type: 'merge_tasks',
        engine: 'tasks',
        title: `Fusionner les deux tâches similaires`,
        reason: `Conserver « ${keep.title} » et archiver « ${duplicate.title} ». Les rappels actifs seront rattachés à la tâche conservée sans doublon.`,
        risk: 'medium',
        requires_confirmation: true,
        parameters: [
          { key: 'keep_task_id', value: keep.id },
          { key: 'duplicate_task_id', value: duplicate.id },
          { key: 'keep_title', value: keep.title },
          { key: 'duplicate_title', value: duplicate.title },
        ],
      },
    ],
    assistant_message: `J’ai repéré que « ${left.title} » et « ${right.title} » semblent correspondre à la même tâche. Je te propose de conserver « ${keep.title} » et d’archiver l’autre. Tu confirmes ?`,
  }
}

export async function POST(request: NextRequest) {
try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuration Supabase incomplète.' }, { status: 500 })
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Session invalide' }, { status: 401 })
    }
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const rl = await rateLimit(supabaseAdmin, user.id, 'nova_v2', { max: 30, windowMinutes: 60 })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'too_many_requests', message: 'Trop de tests en peu de temps. Réessaie plus tard.' },
        { status: 429 }
      )
    }

    const body = (await request.json()) as { message?: unknown; provider?: unknown }
    const message = typeof body.message === 'string' ? body.message.trim() : ''

    if (!message) {
      return NextResponse.json({ error: 'Le message est obligatoire.' }, { status: 400 })
    }
    if (message.length > 5_000) {
      return NextResponse.json({ error: 'Le message est trop long pour ce laboratoire.' }, { status: 400 })
    }

    const providerIsKnown =
      typeof body.provider === 'string' &&
      (body.provider === 'auto' || (NOVA_PROVIDER_IDS as readonly string[]).includes(body.provider))
    const provider: NovaProviderPreference = providerIsKnown
      ? (body.provider as NovaProviderPreference)
      : 'auto'

    const { data: activeTasks, error: activeTasksError } = await supabaseAdmin
      .from('todo_list')
      .select('id,title,description,category,due_date,due_time,status,created_at')
      .eq('user_id', user.id)
      .in('status', ['pending', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(30)

    if (activeTasksError) {
      console.warn('[api/nova/plan] task context unavailable', activeTasksError.message)
    }

    const calendarWindowStart = new Date()
    calendarWindowStart.setDate(calendarWindowStart.getDate() - 30)

    const { data: activeEvents, error: activeEventsError } = await supabaseAdmin
      .from('planner_events')
      .select('id,title,start_date,end_date,location,attendees,status,reminder_minutes_before')
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .gte('end_date', calendarWindowStart.toISOString())
      .order('start_date', { ascending: true })
      .limit(200)

    if (activeEventsError) {
      console.warn('[api/nova/plan] calendar context unavailable', activeEventsError.message)
    }

    const { data: activeReminders, error: activeRemindersError } = await supabaseAdmin
      .from('task_reminders')
      .select('id,todo_id,scheduled_for,status,message')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('scheduled_for', { ascending: true })
      .limit(40)

    if (activeRemindersError) {
      console.warn('[api/nova/plan] reminder context unavailable', activeRemindersError.message)
    }

    const activeTaskRows = (activeTasks || []) as ActiveTaskContextRow[]
    const taskContext = activeTaskRows
      .map((task: ActiveTaskContextRow) =>
        [
          `id=${task.id}`,
          `titre=${String(task.title || '').replace(/\s+/g, ' ').trim()}`,
          `description=${String(task.description || '').replace(/\s+/g, ' ').trim() || 'aucune'}`,
          `categorie=${task.category || 'aucune'}`,
          `echeance=${task.due_date || 'aucune'}`,
          `heure=${task.due_time || 'aucune'}`,
          `statut=${task.status}`,
        ].join(' ; ')
      )
      .join('\n')

    const activeEventRows = ((activeEvents || []) as ActiveCalendarContextRow[])
    const eventContext = activeEventRows
      .map((event) => [
        `id=${event.id}`,
        `titre=${String(event.title || '').replace(/\s+/g, ' ').trim()}`,
        `debut=${event.start_date}`,
        `fin=${event.end_date}`,
        `lieu=${event.location || 'aucun'}`,
        `participants=${(event.attendees || []).join(', ') || 'aucun'}`,
        `rappel_minutes=${(event.reminder_minutes_before || []).join(',') || 'aucun'}`,
        `statut=${event.status || 'pending'}`,
      ].join(' ; '))
      .join('\n')

    const calendarMatches: RequestCalendarMatch[] = findBestCalendarMatches(
      message,
      activeEventRows,
      0.2
    ).slice(0, 5)
    const calendarMatchContext = calendarMatches
      .map(({ event, score, reasons }) =>
        [
          `score=${score.toFixed(3)}`,
          `id=${event.id}`,
          `titre=${String(event.title || '').replace(/\s+/g, ' ').trim()}`,
          `debut=${event.start_date}`,
          `fin=${event.end_date}`,
          `raisons=${reasons.join(', ') || 'proximite semantique'}`,
        ].join(' ; ')
      )
      .join('\n')

    const reminderContext = ((activeReminders || []) as ActiveReminderContextRow[])
      .map((reminder) => [
        `id=${reminder.id}`,
        `task_id=${reminder.todo_id}`,
        `date=${reminder.scheduled_for}`,
        `message=${String(reminder.message || '').replace(/\s+/g, ' ').trim() || 'aucun'}`,
        `statut=${reminder.status}`,
      ].join(' ; '))
      .join('\n')

    const duplicatePairs = findLikelyDuplicatePairs(activeTaskRows, 0.76).slice(0, 8)
    const duplicateContext = duplicatePairs
      .map(({ left, right, comparison }) =>
        [
          `score=${comparison.score}`,
          `tache_a=${left.id}|${String(left.title || '').replace(/\s+/g, ' ').trim()}`,
          `tache_b=${right.id}|${String(right.title || '').replace(/\s+/g, ' ').trim()}`,
          `raisons=${comparison.reasons.join(', ') || 'similarite lexicale'}`,
        ].join(' ; ')
      )
      .join('\n')

    const requestMatches = findBestTaskMatches(message, activeTaskRows, 0.25).slice(0, 5)
    const requestMatchContext = requestMatches
      .map(({ task, comparison }) =>
        `score=${comparison.score} ; id=${task.id} ; titre=${String(task.title || '')
          .replace(/\s+/g, ' ')
          .trim()}`
      )
      .join('\n')

    const messageWithContext = [
      message,
      '',
      'CONTEXTE INTERNE NOVAÉ - ne jamais réciter les identifiants techniques à l’utilisatrice :',
      'TÃ¢ches actives connues :',
      taskContext || 'aucune tâche active',
      '',
      'Correspondances probables entre la demande et les tâches actives :',
      requestMatchContext || 'aucune correspondance suffisamment proche',
      '',
      'Groupes de tâches déjà  existantes qui semblent être des doublons :',
      duplicateContext || 'aucun doublon probable détecté',
      '',
      'Rendez-vous actifs connus :',
      eventContext || 'aucun rendez-vous actif',
      '',
      'Correspondances prioritaires entre la demande et les rendez-vous actifs :',
      calendarMatchContext || 'aucune correspondance suffisamment proche',
      '',
      'RÈGLE DE RÉSOLUTION DES RENDEZ-VOUS :',
      calendarMatches.length > 0 && (calendarMatches.length === 1 || calendarMatches[0].score - calendarMatches[1].score >= 0.12)
        ? `Le rendez-vous prioritaire est id=${calendarMatches[0].event.id}, titre=${calendarMatches[0].event.title}, debut=${calendarMatches[0].event.start_date}, fin=${calendarMatches[0].event.end_date}. Considère-le comme identifié. Ne dis jamais qu'il est absent et ne redemande pas son identité. Pour une modification ou annulation, utilise obligatoirement cet id dans event_id. Demande seulement les informations réellement manquantes sur le nouvel horaire.`
        : 'Plusieurs rendez-vous restent plausibles : demande lequel utiliser sans prétendre qu’aucun rendez-vous n’existe.',
      '',
      'Rappels de tâches encore en attente :',
      reminderContext || 'aucun rappel en attente',
      '',
      'Utilise ce contexte uniquement pour comprendre les références, éviter les doublons, retrouver précisément une tâche, un rappel ou un rendez-vous et préparer une création, modification ou annulation après validation.',
    ].join('\n')

    const result = await createNovaActionPlan(
      {
        message: messageWithContext,
        locale: 'fr-FR',
        timezone: 'Europe/Paris',
        nowIso: new Date().toISOString(),
      },
      provider
    )

    result.plan = applyTaskIdentityGuard(
      result.plan,
      message,
      duplicatePairs,
      requestMatches
    )

    const hasConfirmableAction = result.plan.proposed_actions.some(
      (action) => action.requires_confirmation
    )
    const hasBlockingMissingInformation = result.plan.missing_information.some(
      (item) => item.blocking
    )

    let executionToken: string | undefined
    if (hasConfirmableAction && !hasBlockingMissingInformation) {
      try {
        executionToken = createNovaExecutionToken(user.id, result.plan)
      } catch (tokenError) {
        console.warn('[api/nova/plan] execution token unavailable', tokenError)
      }
    }

    return NextResponse.json({ ...result, executionToken })
  } catch (error) {
    console.error('[api/nova/plan] error', error)
    return NextResponse.json(
      {
        error: 'nova_plan_failed',
        message: error instanceof Error ? error.message : 'Impossible d’analyser la demande.',
      },
      { status: 502 }
    )
  }
}

