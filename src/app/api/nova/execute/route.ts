import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'
import { verifyNovaExecutionToken } from '@/lib/nova-ai/action-token'
import {
  normalizeTaskTitle,
  prepareTaskInsert,
  type PreparedTaskInsert,
} from '@/lib/nova-ai/task-execution'
import {
  prepareReminderInsert,
  type PreparedReminderInsert,
} from '@/lib/nova-ai/reminder-execution'
import { compareTaskIdentity } from '@/lib/nova-ai/task-identity'
import { prepareCalendarInsert, type PreparedCalendarInsert } from '@/lib/nova-ai/calendar-execution'
import { executeLifecycleAction } from '@/lib/nova-ai/lifecycle-execution'
import { parisMinutesFromIso } from '@/lib/nova-ai/timezone'
import {
  prepareTaskMerge,
  type PreparedTaskMerge,
} from '@/lib/nova-ai/task-merge-execution'
import type {
  NovaReminderExecutionItem,
  NovaTaskExecutionItem,
  NovaTaskMergeExecutionItem,
  NovaCalendarExecutionItem,
  NovaLifecycleExecutionItem,
} from '@/lib/nova-ai/types'

export const runtime = 'nodejs'
export const maxDuration = 30

type StoredTask = {
  id: string
  title: string
  description: string | null
  category: string | null
  project: string | null
  tags: string[] | null
  priority: string | null
  due_date: string | null
  due_time: string | null
  status: string
  estimated_duration_minutes: number | null
  merged_into_todo_id: string | null
  merged_at: string | null
  created_at: string
}

type StoredReminder = {
  id: string
  todo_id: string
  scheduled_for: string
  status: string
  message: string | null
  created_at: string
}

const TASK_SELECT = [
  'id',
  'title',
  'description',
  'category',
  'project',
  'tags',
  'priority',
  'due_date',
  'due_time',
  'status',
  'estimated_duration_minutes',
  'merged_into_todo_id',
  'merged_at',
  'created_at',
].join(',')

function labEnabled(): boolean {
  return process.env.NOVA_V2_LAB_ENABLED === 'true'
}

function allowedEmails(): string[] {
  return (process.env.NOVA_V2_LAB_ALLOWED_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

function buildUserClient(supabaseUrl: string, anonKey: string, token: string) {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function findDuplicateTask(
  db: ReturnType<typeof buildUserClient>,
  userId: string,
  task: PreparedTaskInsert
): Promise<StoredTask | null> {
  const { data, error } = await db
    .from('todo_list')
    .select(TASK_SELECT)
    .eq('user_id', userId)
    .in('status', ['pending', 'in_progress'])
    .limit(100)

  if (error) throw new Error(`Impossible de vérifier les doublons : ${error.message}`)

  const candidates = ((data || []) as unknown as unknown as unknown as StoredTask[])
    .map((candidate) => ({
      candidate,
      comparison: compareTaskIdentity(
        {
          title: task.title,
          description: task.description,
          due_date: task.dueDate,
          due_time: task.dueTime,
          category: task.category,
        },
        candidate
      ),
    }))
    .sort((left, right) => right.comparison.score - left.comparison.score)

  const exactTitle = candidates.find(
    ({ candidate }) => normalizeTaskTitle(candidate.title) === normalizeTaskTitle(task.title)
  )
  if (exactTitle) return exactTitle.candidate

  const strong = candidates[0]
  if (!strong || strong.comparison.score < 0.9) return null

  const dateConflict =
    !!task.dueDate && !!strong.candidate.due_date && task.dueDate !== strong.candidate.due_date
  if (dateConflict) return null

  return strong.candidate
}

async function createAndVerifyTask(
  db: ReturnType<typeof buildUserClient>,
  userId: string,
  task: PreparedTaskInsert
): Promise<NovaTaskExecutionItem> {
  const duplicate = await findDuplicateTask(db, userId, task)
  if (duplicate) {
    return {
      kind: 'task',
      actionId: task.actionId,
      status: 'already_exists',
      task: duplicate,
      message: `La tâche « ${duplicate.title} » existait déjà dans ta to-do. Je n’ai pas créé de doublon.`,
    }
  }

  const { data: inserted, error: insertError } = await db
    .from('todo_list')
    .insert({
      user_id: userId,
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      due_date: task.dueDate,
      due_time: task.dueTime,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError || !inserted?.id) {
    throw new Error(insertError?.message || 'La tâche n’a pas pu être créée.')
  }

  const { data: verified, error: verifyError } = await db
    .from('todo_list')
    .select(TASK_SELECT)
    .eq('id', inserted.id)
    .eq('user_id', userId)
    .single()

  if (verifyError || !verified) {
    throw new Error(verifyError?.message || 'La tâche a été créée mais sa vérification a échoué.')
  }

  const storedTask = verified as unknown as unknown as unknown as StoredTask
  if (
    normalizeTaskTitle(storedTask.title) !== normalizeTaskTitle(task.title) ||
    (storedTask.due_date || null) !== task.dueDate ||
    storedTask.status !== 'pending'
  ) {
    throw new Error('La tâche enregistrée ne correspond pas entièrement à la proposition validée.')
  }

  return {
    kind: 'task',
    actionId: task.actionId,
    status: 'created',
    task: storedTask,
    message: `C’est fait. La tâche « ${storedTask.title} » a été ajoutée à ta to-do${
      storedTask.due_date ? ` pour le ${storedTask.due_date}` : ''
    }.`,
  }
}

async function resolveReminderTask(
  db: ReturnType<typeof buildUserClient>,
  userId: string,
  reminder: PreparedReminderInsert
): Promise<StoredTask> {
  if (reminder.taskId) {
    const { data, error } = await db
      .from('todo_list')
      .select(TASK_SELECT)
      .eq('id', reminder.taskId)
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .maybeSingle()

    if (error) throw new Error(`Impossible de retrouver la tâche : ${error.message}`)
    if (data) return data as unknown as unknown as unknown as StoredTask
  }

  const { data, error } = await db
    .from('todo_list')
    .select(TASK_SELECT)
    .eq('user_id', userId)
    .in('status', ['pending', 'in_progress'])
    .limit(100)

  if (error) throw new Error(`Impossible de retrouver la tâche : ${error.message}`)

  const tasks = (data || []) as unknown as unknown as unknown as StoredTask[]
  const exactCandidates = tasks.filter(
    (task) => normalizeTaskTitle(task.title) === reminder.taskTitle
  )

  if (exactCandidates.length === 1) return exactCandidates[0]
  if (exactCandidates.length > 1) {
    throw new Error('Plusieurs tâches portent ce titre. Précise laquelle doit recevoir le rappel.')
  }

  const semanticCandidates = tasks
    .map((task) => ({
      task,
      comparison: compareTaskIdentity({ title: reminder.taskTitle }, task),
    }))
    .filter(({ comparison }) => comparison.score >= 0.76)
    .sort((left, right) => right.comparison.score - left.comparison.score)

  if (semanticCandidates.length === 0) {
    throw new Error('La tâche à laquelle rattacher ce rappel est introuvable ou déjà terminée.')
  }

  const best = semanticCandidates[0]
  const second = semanticCandidates[1]
  if (
    best.comparison.score < 0.9 ||
    (second && best.comparison.score - second.comparison.score < 0.08)
  ) {
    throw new Error(
      'Plusieurs tâches semblent correspondre à cette demande. Demande d’abord à Nova de les fusionner ou précise la tâche exacte.'
    )
  }

  return best.task
}

function formatReminderDateFr(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

async function createAndVerifyReminder(
  db: ReturnType<typeof buildUserClient>,
  userId: string,
  reminder: PreparedReminderInsert
): Promise<NovaReminderExecutionItem> {
  const task = await resolveReminderTask(db, userId, reminder)

  const normalizedReminderDate = new Date(reminder.scheduledFor)
  normalizedReminderDate.setUTCSeconds(0, 0)
  const normalizedScheduledFor = normalizedReminderDate.toISOString()
  const minuteEnd = new Date(normalizedReminderDate.getTime() + 60_000).toISOString()

  // On cherche sur toute la minute, y compris les anciennes lignes qui ont
  // pu conserver quelques secondes (ex. 13:13:08 au lieu de 13:13:00).
  const { data: duplicateRows, error: duplicateError } = await db
    .from('task_reminders')
    .select('id,todo_id,scheduled_for,status,message,created_at')
    .eq('user_id', userId)
    .eq('todo_id', task.id)
    .gte('scheduled_for', normalizedScheduledFor)
    .lt('scheduled_for', minuteEnd)
    .in('status', ['pending', 'sent'])
    .order('created_at', { ascending: true })
    .limit(1)

  if (duplicateError) {
    throw new Error(`Impossible de vérifier les rappels existants : ${duplicateError.message}`)
  }

  const duplicate = (duplicateRows || [])[0] as StoredReminder | undefined

  if (duplicate) {
    return {
      kind: 'reminder',
      actionId: reminder.actionId,
      status: 'already_exists',
      reminder: duplicate as StoredReminder,
      task: {
        id: task.id,
        title: task.title,
        due_date: task.due_date,
        due_time: task.due_time,
        status: task.status,
      },
      message: `Un rappel était déjà prévu le ${formatReminderDateFr(
        duplicate.scheduled_for
      )} pour la tâche « ${task.title} ». Je n’ai pas créé de doublon.`,
    }
  }

  const { data: inserted, error: insertError } = await db
    .from('task_reminders')
    .insert({
      user_id: userId,
      todo_id: task.id,
      scheduled_for: normalizedScheduledFor,
      status: 'pending',
      channel: 'push_and_in_app',
      message: reminder.message,
      source: 'nova',
    })
    .select('id')
    .single()

  if (insertError || !inserted?.id) {
    if (insertError?.code === '23505') {
      const { data: existingRows } = await db
        .from('task_reminders')
        .select('id,todo_id,scheduled_for,status,message,created_at')
        .eq('user_id', userId)
        .eq('todo_id', task.id)
        .gte('scheduled_for', normalizedScheduledFor)
        .lt('scheduled_for', minuteEnd)
        .in('status', ['pending', 'sent'])
        .order('created_at', { ascending: true })
        .limit(1)

      const existing = (existingRows || [])[0] as StoredReminder | undefined
      if (existing) {
        return {
          kind: 'reminder',
          actionId: reminder.actionId,
          status: 'already_exists',
          reminder: existing,
          task: {
            id: task.id,
            title: task.title,
            due_date: task.due_date,
            due_time: task.due_time,
            status: task.status,
          },
          message: `Un rappel était déjà prévu le ${formatReminderDateFr(
            existing.scheduled_for
          )} pour la tâche « ${task.title} ». Je n’ai pas créé de doublon.`,
        }
      }
    }
    throw new Error(insertError?.message || 'Le rappel n’a pas pu être programmé.')
  }

  const { data: verified, error: verifyError } = await db
    .from('task_reminders')
    .select('id,todo_id,scheduled_for,status,message,created_at')
    .eq('id', inserted.id)
    .eq('user_id', userId)
    .single()

  if (verifyError || !verified) {
    throw new Error(verifyError?.message || 'Le rappel a été créé mais sa vérification a échoué.')
  }

  const storedReminder = verified as StoredReminder
  if (
    storedReminder.todo_id !== task.id ||
    new Date(storedReminder.scheduled_for).getTime() !== new Date(normalizedScheduledFor).getTime() ||
    storedReminder.status !== 'pending'
  ) {
    throw new Error('Le rappel enregistré ne correspond pas entièrement à la proposition validée.')
  }

  return {
    kind: 'reminder',
    actionId: reminder.actionId,
    status: 'scheduled',
    reminder: storedReminder,
    task: {
      id: task.id,
      title: task.title,
      due_date: task.due_date,
      due_time: task.due_time,
      status: task.status,
    },
    message: `C’est fait. Je te rappellerai la tâche « ${task.title} » le ${formatReminderDateFr(
      storedReminder.scheduled_for
    )}.`,
  }
}



type StoredCalendarEvent = {
  id: string
  title: string
  start_date: string
  end_date: string
  location: string | null
  source_todo_id: string | null
  status: string | null
}

function formatCalendarDateFr(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

async function createAndVerifyCalendarEvent(
  db: ReturnType<typeof buildUserClient>, userId: string, event: PreparedCalendarInsert
): Promise<NovaCalendarExecutionItem> {
  if (event.taskId) {
    const { data: task } = await db.from('todo_list').select('id,title,status').eq('id', event.taskId).eq('user_id', userId).maybeSingle()
    if (!task) throw new Error('La tâche à planifier est introuvable.')
    const { data: existingBlock } = await db.from('planner_events')
      .select('id,title,start_date,end_date,location,source_todo_id,status')
      .eq('user_id', userId).eq('source_todo_id', event.taskId).neq('status', 'cancelled').limit(1).maybeSingle()
    if (existingBlock) {
      return { kind:'calendar_event', actionId:event.actionId, status:'already_exists', event: existingBlock as StoredCalendarEvent, conflicts:[], message:`La tâche « ${task.title} » est déjà placée dans ton planning. Je n’ai pas créé de doublon.` }
    }
  }

  const { data: conflicts, error: conflictError } = await db.from('planner_events')
    .select('id,title,start_date,end_date')
    .eq('user_id', userId)
    .lt('start_date', event.endAt)
    .gt('end_date', event.startAt)
    .neq('status', 'cancelled')
    .limit(10)
  if (conflictError) throw new Error(`Impossible de vérifier les conflits : ${conflictError.message}`)
  if ((conflicts || []).length > 0) {
    const list = (conflicts || []) as Array<{id:string;title:string;start_date:string;end_date:string}>
    return { kind:'calendar_event', actionId:event.actionId, status:'conflict', event:null, conflicts:list, message:`Je n’ai rien ajouté : ce créneau chevauche « ${list[0].title} ». Modifie l’horaire ou confirme une exception dans un prochain échange.` }
  }

  const startMinutes = parisMinutesFromIso(event.startAt)
  const endMinutes = parisMinutesFromIso(event.endAt)
  const { data: inserted, error } = await db.from('planner_events').insert({
    user_id:userId, title:event.title, description:event.description, location:event.location,
    start_date:event.startAt, end_date:event.endAt, start_minutes:startMinutes, end_minutes:endMinutes,
    category:event.category, attendees:event.attendees, reminder_minutes_before:event.reminderMinutesBefore > 0 ? [event.reminderMinutesBefore] : [],
    reminder_sent:false, status:'pending', source_todo_id:event.taskId,
  }).select('id').single()
  if (error || !inserted?.id) throw new Error(error?.message || 'Le rendez-vous n’a pas pu être ajouté.')
  const { data: verified, error: verifyError } = await db.from('planner_events')
    .select('id,title,start_date,end_date,location,source_todo_id,status').eq('id', inserted.id).eq('user_id', userId).single()
  if (verifyError || !verified) throw new Error(verifyError?.message || 'Le rendez-vous a été créé mais sa vérification a échoué.')
  return { kind:'calendar_event', actionId:event.actionId, status:'created', event:verified as StoredCalendarEvent, conflicts:[], message:`C’est fait. J’ai ajouté « ${event.title} » à ton planning le ${formatCalendarDateFr(event.startAt)}.` }
}

async function readTaskForMerge(
  db: ReturnType<typeof buildUserClient>,
  userId: string,
  taskId: string
): Promise<StoredTask | null> {
  const { data, error } = await db
    .from('todo_list')
    .select(TASK_SELECT)
    .eq('id', taskId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(`Impossible de lire la tâche : ${error.message}`)
  return data ? (data as unknown as unknown as unknown as StoredTask) : null
}

type MergeRpcResult = {
  already_merged?: boolean
  kept_task_id?: string
  archived_task_id?: string
  reminders_moved?: number
  reminder_duplicates_cancelled?: number
  merged_at?: string
}

async function mergeAndVerifyTasks(
  db: ReturnType<typeof buildUserClient>,
  userId: string,
  merge: PreparedTaskMerge
): Promise<NovaTaskMergeExecutionItem> {
  const keepTask = await readTaskForMerge(db, userId, merge.keepTaskId)
  const duplicateTask = await readTaskForMerge(db, userId, merge.duplicateTaskId)

  if (!keepTask || !duplicateTask) {
    throw new Error('L’une des tâches à fusionner est introuvable.')
  }

  if (
    duplicateTask.status === 'cancelled' &&
    duplicateTask.merged_into_todo_id === keepTask.id
  ) {
    return {
      kind: 'task_merge',
      actionId: merge.actionId,
      status: 'already_merged',
      keptTask: {
        id: keepTask.id,
        title: keepTask.title,
        due_date: keepTask.due_date,
        due_time: keepTask.due_time,
        status: keepTask.status,
      },
      archivedTask: {
        id: duplicateTask.id,
        title: duplicateTask.title,
        status: duplicateTask.status,
        merged_into_todo_id: duplicateTask.merged_into_todo_id,
        merged_at: duplicateTask.merged_at,
      },
      remindersMoved: 0,
      reminderDuplicatesCancelled: 0,
      message: `Ces deux tâches avaient déjà été fusionnées. « ${keepTask.title} » reste la tâche active.`,
    }
  }

  const comparison = compareTaskIdentity(keepTask, duplicateTask)
  if (comparison.score < 0.76) {
    throw new Error(
      'Ces tâches ne sont pas assez similaires pour être fusionnées en sécurité.'
    )
  }

  if (
    keepTask.due_date &&
    duplicateTask.due_date &&
    keepTask.due_date !== duplicateTask.due_date
  ) {
    throw new Error(
      'Les deux tâches ont des échéances différentes. Modifie d’abord la proposition ou conserve les deux tâches.'
    )
  }

  const { data: rpcData, error: rpcError } = await db.rpc('nova_merge_tasks', {
    p_keep_task_id: keepTask.id,
    p_duplicate_task_id: duplicateTask.id,
  })

  if (rpcError) {
    throw new Error(`Impossible de fusionner les tâches : ${rpcError.message}`)
  }

  const rpcResult = (rpcData || {}) as MergeRpcResult
  const verifiedKeep = await readTaskForMerge(db, userId, keepTask.id)
  const verifiedDuplicate = await readTaskForMerge(db, userId, duplicateTask.id)

  if (!verifiedKeep || !verifiedDuplicate) {
    throw new Error('La fusion a été enregistrée mais sa vérification a échoué.')
  }
  if (
    verifiedDuplicate.status !== 'cancelled' ||
    verifiedDuplicate.merged_into_todo_id !== verifiedKeep.id ||
    !verifiedDuplicate.merged_at
  ) {
    throw new Error('La tâche doublon n’a pas été archivée correctement.')
  }

  const remindersMoved = Number(rpcResult.reminders_moved || 0)
  const reminderDuplicatesCancelled = Number(
    rpcResult.reminder_duplicates_cancelled || 0
  )

  return {
    kind: 'task_merge',
    actionId: merge.actionId,
    status: rpcResult.already_merged ? 'already_merged' : 'merged',
    keptTask: {
      id: verifiedKeep.id,
      title: verifiedKeep.title,
      due_date: verifiedKeep.due_date,
      due_time: verifiedKeep.due_time,
      status: verifiedKeep.status,
    },
    archivedTask: {
      id: verifiedDuplicate.id,
      title: verifiedDuplicate.title,
      status: verifiedDuplicate.status,
      merged_into_todo_id: verifiedDuplicate.merged_into_todo_id,
      merged_at: verifiedDuplicate.merged_at,
    },
    remindersMoved,
    reminderDuplicatesCancelled,
    message: rpcResult.already_merged
      ? `Ces deux tâches avaient déjà été fusionnées. « ${verifiedKeep.title} » reste la tâche active.`
      : `C’est fait. J’ai conservé « ${verifiedKeep.title} » et archivé le doublon « ${verifiedDuplicate.title} ».${
          remindersMoved > 0
            ? ` ${remindersMoved} rappel${remindersMoved > 1 ? 's ont' : ' a'} été rattaché${remindersMoved > 1 ? 's' : ''} à la tâche conservée.`
            : ''
        }`,
  }
}

export async function POST(request: NextRequest) {
  if (!labEnabled()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

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

    const userClient = buildUserClient(supabaseUrl, anonKey, token)
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Session invalide' }, { status: 401 })
    }

    const allowlist = allowedEmails()
    const email = user.email?.toLowerCase() || ''
    if (allowlist.length > 0 && !allowlist.includes(email)) {
      return NextResponse.json({ error: 'Accès au laboratoire refusé.' }, { status: 403 })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const rl = await rateLimit(adminClient, user.id, 'nova_v2_execute', {
      max: 30,
      windowMinutes: 60,
    })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'too_many_requests', message: 'Trop d’actions en peu de temps. Réessaie plus tard.' },
        { status: 429 }
      )
    }

    const body = (await request.json()) as { executionToken?: unknown }
    const executionToken = typeof body.executionToken === 'string' ? body.executionToken : ''
    if (!executionToken) {
      return NextResponse.json({ error: 'La proposition validée est manquante.' }, { status: 400 })
    }

    const payload = verifyNovaExecutionToken(executionToken)
    if (payload.userId !== user.id) {
      return NextResponse.json({ error: 'Cette proposition appartient à un autre compte.' }, { status: 403 })
    }

    if (payload.plan.missing_information.some((item) => item.blocking)) {
      return NextResponse.json(
        { error: 'Des informations obligatoires sont encore manquantes.' },
        { status: 409 }
      )
    }

    const confirmedActions = payload.plan.proposed_actions.filter(
      (action) => action.requires_confirmation
    )
    const taskActions = confirmedActions.filter(
      (action) => action.type === 'create_task' && action.engine === 'tasks'
    )
    const reminderActions = confirmedActions.filter(
      (action) => action.type === 'create_reminder' && action.engine === 'notifications'
    )
    const mergeActions = confirmedActions.filter(
      (action) => action.type === 'merge_tasks' && action.engine === 'tasks'
    )
    const calendarActions = confirmedActions.filter(
      (action) => action.type === 'create_calendar_event' && action.engine === 'calendar'
    )
    const lifecycleActions = confirmedActions.filter((action) =>
      ['update_task','cancel_task','update_reminder','cancel_reminder','update_calendar_event','cancel_calendar_event'].includes(action.type)
    )
    const unsupportedActions = confirmedActions.filter(
      (action) =>
        !(
          (action.type === 'create_task' && action.engine === 'tasks') ||
          (action.type === 'create_reminder' && action.engine === 'notifications') ||
          (action.type === 'merge_tasks' && action.engine === 'tasks') ||
          (action.type === 'create_calendar_event' && action.engine === 'calendar') ||
          ['update_task','cancel_task','update_reminder','cancel_reminder','update_calendar_event','cancel_calendar_event'].includes(action.type)
        )
    )

    if (taskActions.length + reminderActions.length + mergeActions.length + calendarActions.length + lifecycleActions.length === 0) {
      return NextResponse.json(
        {
          error: 'action_not_enabled',
          message: 'Cette action a bien été validée, mais son moteur d’exécution n’est pas encore activé.',
          unsupportedActions: unsupportedActions.map((action) => ({
            id: action.id,
            type: action.type,
            title: action.title,
          })),
        },
        { status: 409 }
      )
    }

    if (taskActions.length > 5 || reminderActions.length > 5 || mergeActions.length > 3 || calendarActions.length > 5 || lifecycleActions.length > 8) {
      return NextResponse.json({ error: 'Trop d’actions dans une seule validation.' }, { status: 400 })
    }

    const results: Array<
      NovaTaskExecutionItem | NovaReminderExecutionItem | NovaTaskMergeExecutionItem | NovaCalendarExecutionItem | NovaLifecycleExecutionItem
    > = []

    for (const action of taskActions) {
      try {
        const prepared = prepareTaskInsert(action, payload.plan)
        results.push(await createAndVerifyTask(userClient, user.id, prepared))
      } catch (error) {
        results.push({
          kind: 'task',
          actionId: action.id,
          status: 'failed',
          task: null,
          message: error instanceof Error ? error.message : 'La tâche n’a pas pu être créée.',
        })
      }
    }

    for (const action of reminderActions) {
      try {
        const prepared = prepareReminderInsert(action, payload.plan)
        results.push(await createAndVerifyReminder(userClient, user.id, prepared))
      } catch (error) {
        results.push({
          kind: 'reminder',
          actionId: action.id,
          status: 'failed',
          reminder: null,
          task: null,
          message: error instanceof Error ? error.message : 'Le rappel n’a pas pu être programmé.',
        })
      }
    }

    for (const action of mergeActions) {
      try {
        const prepared = prepareTaskMerge(action, payload.plan)
        results.push(await mergeAndVerifyTasks(userClient, user.id, prepared))
      } catch (error) {
        results.push({
          kind: 'task_merge',
          actionId: action.id,
          status: 'failed',
          keptTask: null,
          archivedTask: null,
          remindersMoved: 0,
          reminderDuplicatesCancelled: 0,
          message: error instanceof Error ? error.message : 'Les tâches n’ont pas pu être fusionnées.',
        })
      }
    }

    for (const action of calendarActions) {
      try {
        const prepared = prepareCalendarInsert(action, payload.plan)
        results.push(await createAndVerifyCalendarEvent(userClient, user.id, prepared))
      } catch (error) {
        results.push({ kind:'calendar_event', actionId:action.id, status:'failed', event:null, conflicts:[], message:error instanceof Error ? error.message : 'Le rendez-vous n’a pas pu être ajouté.' })
      }
    }

    for (const action of lifecycleActions) {
      try {
        results.push(await executeLifecycleAction(userClient, user.id, action, payload.plan))
      } catch (error) {
        const kind = action.type.startsWith('update_task') ? 'task_update'
          : action.type.startsWith('cancel_task') ? 'task_cancel'
          : action.type.startsWith('update_reminder') ? 'reminder_update'
          : action.type.startsWith('cancel_reminder') ? 'reminder_cancel'
          : action.type.startsWith('update_calendar') ? 'calendar_update'
          : 'calendar_cancel'
        results.push({ kind, actionId: action.id, status: 'failed', entityId: null, message: error instanceof Error ? error.message : 'La modification n’a pas pu être exécutée.' } as NovaLifecycleExecutionItem)
      }
    }

    const tasksCreated = results.filter(
      (item) => item.kind === 'task' && item.status === 'created'
    ).length
    const remindersScheduled = results.filter(
      (item) => item.kind === 'reminder' && item.status === 'scheduled'
    ).length
    const tasksMerged = results.filter(
      (item) => item.kind === 'task_merge' && item.status === 'merged'
    ).length
    const calendarEventsCreated = results.filter(
      (item) => item.kind === 'calendar_event' && item.status === 'created'
    ).length
    const actionsUpdated = results.filter((item) => item.status === 'updated').length
    const actionsCancelled = results.filter((item) => item.status === 'cancelled').length
    const alreadyExists = results.filter(
      (item) => item.status === 'already_exists' || item.status === 'already_merged'
    ).length
    const failed = results.filter((item) => item.status === 'failed' || item.status === 'conflict').length

    const messageParts = results.map((item) => item.message)
    if (unsupportedActions.length > 0) {
      messageParts.push('Les autres actions proposées ne sont pas encore exécutées dans ce laboratoire.')
    }

    const httpStatus = tasksCreated + remindersScheduled + tasksMerged + calendarEventsCreated + actionsUpdated + actionsCancelled + alreadyExists > 0 ? 200 : (results.some(item => item.status === 'conflict') ? 409 : 500)
    return NextResponse.json(
      {
        ok: failed === 0,
        message: messageParts.join(' '),
        results,
        counts: {
          tasksCreated,
          remindersScheduled,
          tasksMerged,
          calendarEventsCreated,
          actionsUpdated,
          actionsCancelled,
          alreadyExists,
          failed,
          unsupported: unsupportedActions.length,
        },
      },
      { status: httpStatus }
    )
  } catch (error) {
    console.error('[api/nova/execute] error', error)
    return NextResponse.json(
      {
        error: 'nova_execute_failed',
        message: error instanceof Error ? error.message : 'Impossible d’exécuter la proposition.',
      },
      { status: 500 }
    )
  }
}
