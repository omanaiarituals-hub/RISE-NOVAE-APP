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
import type {
  NovaReminderExecutionItem,
  NovaTaskExecutionItem,
} from '@/lib/nova-ai/types'

export const runtime = 'nodejs'
export const maxDuration = 30

type StoredTask = {
  id: string
  title: string
  description: string | null
  category: string | null
  priority: string | null
  due_date: string | null
  due_time: string | null
  status: string
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
  let query = db
    .from('todo_list')
    .select('id,title,description,category,priority,due_date,due_time,status,created_at')
    .eq('user_id', userId)
    .in('status', ['pending', 'in_progress'])
    .limit(100)

  query = task.dueDate ? query.eq('due_date', task.dueDate) : query.is('due_date', null)

  const { data, error } = await query
  if (error) throw new Error(`Impossible de vérifier les doublons : ${error.message}`)

  const normalizedTitle = normalizeTaskTitle(task.title)
  return (
    ((data || []) as StoredTask[]).find(
      (candidate) => normalizeTaskTitle(candidate.title) === normalizedTitle
    ) || null
  )
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
    .select('id,title,description,category,priority,due_date,due_time,status,created_at')
    .eq('id', inserted.id)
    .eq('user_id', userId)
    .single()

  if (verifyError || !verified) {
    throw new Error(verifyError?.message || 'La tâche a été créée mais sa vérification a échoué.')
  }

  const storedTask = verified as StoredTask
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
      .select('id,title,description,category,priority,due_date,due_time,status,created_at')
      .eq('id', reminder.taskId)
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .maybeSingle()

    if (error) throw new Error(`Impossible de retrouver la tâche : ${error.message}`)
    if (data) return data as StoredTask
  }

  const { data, error } = await db
    .from('todo_list')
    .select('id,title,description,category,priority,due_date,due_time,status,created_at')
    .eq('user_id', userId)
    .in('status', ['pending', 'in_progress'])
    .limit(100)

  if (error) throw new Error(`Impossible de retrouver la tâche : ${error.message}`)

  const candidates = ((data || []) as StoredTask[]).filter(
    (task) => normalizeTaskTitle(task.title) === reminder.taskTitle
  )

  if (candidates.length === 0) {
    throw new Error('La tâche à laquelle rattacher ce rappel est introuvable ou déjà terminée.')
  }
  if (candidates.length > 1) {
    throw new Error('Plusieurs tâches portent ce titre. Précise laquelle doit recevoir le rappel.')
  }

  return candidates[0]
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
    const unsupportedActions = confirmedActions.filter(
      (action) =>
        !(
          (action.type === 'create_task' && action.engine === 'tasks') ||
          (action.type === 'create_reminder' && action.engine === 'notifications')
        )
    )

    if (taskActions.length + reminderActions.length === 0) {
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

    if (taskActions.length > 5 || reminderActions.length > 5) {
      return NextResponse.json({ error: 'Trop d’actions dans une seule validation.' }, { status: 400 })
    }

    const results: Array<NovaTaskExecutionItem | NovaReminderExecutionItem> = []

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

    const tasksCreated = results.filter(
      (item) => item.kind === 'task' && item.status === 'created'
    ).length
    const remindersScheduled = results.filter(
      (item) => item.kind === 'reminder' && item.status === 'scheduled'
    ).length
    const alreadyExists = results.filter((item) => item.status === 'already_exists').length
    const failed = results.filter((item) => item.status === 'failed').length

    const messageParts = results.map((item) => item.message)
    if (unsupportedActions.length > 0) {
      messageParts.push('Les autres actions proposées ne sont pas encore exécutées dans ce laboratoire.')
    }

    const httpStatus = tasksCreated + remindersScheduled + alreadyExists > 0 ? 200 : 500
    return NextResponse.json(
      {
        ok: failed === 0,
        message: messageParts.join(' '),
        results,
        counts: {
          tasksCreated,
          remindersScheduled,
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
