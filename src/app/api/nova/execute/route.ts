import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'
import { verifyNovaExecutionToken } from '@/lib/nova-ai/action-token'
import {
  normalizeTaskTitle,
  prepareTaskInsert,
  type PreparedTaskInsert,
} from '@/lib/nova-ai/task-execution'

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

type TaskExecutionItem = {
  actionId: string
  status: 'created' | 'already_exists' | 'failed'
  task: StoredTask | null
  message: string
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
): Promise<TaskExecutionItem> {
  const duplicate = await findDuplicateTask(db, userId, task)
  if (duplicate) {
    return {
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
    actionId: task.actionId,
    status: 'created',
    task: storedTask,
    message: `C’est fait. La tâche « ${storedTask.title} » a été ajoutée à ta to-do${
      storedTask.due_date ? ` pour le ${storedTask.due_date}` : ''
    }.`,
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
    const rl = await rateLimit(adminClient, user.id, 'nova_v2_execute_task', {
      max: 20,
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
    const unsupportedActions = confirmedActions.filter(
      (action) => action.type !== 'create_task' || action.engine !== 'tasks'
    )

    if (taskActions.length === 0) {
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

    if (taskActions.length > 5) {
      return NextResponse.json({ error: 'Trop de tâches dans une seule validation.' }, { status: 400 })
    }

    const results: TaskExecutionItem[] = []
    for (const action of taskActions) {
      try {
        const prepared = prepareTaskInsert(action, payload.plan)
        results.push(await createAndVerifyTask(userClient, user.id, prepared))
      } catch (error) {
        results.push({
          actionId: action.id,
          status: 'failed',
          task: null,
          message: error instanceof Error ? error.message : 'La tâche n’a pas pu être créée.',
        })
      }
    }

    const createdCount = results.filter((item) => item.status === 'created').length
    const duplicateCount = results.filter((item) => item.status === 'already_exists').length
    const failedCount = results.filter((item) => item.status === 'failed').length

    const messageParts = results.map((item) => item.message)
    if (unsupportedActions.length > 0) {
      messageParts.push(
        'Les autres actions proposées ne sont pas encore exécutées dans ce laboratoire.'
      )
    }

    const httpStatus = createdCount + duplicateCount > 0 ? 200 : 500
    return NextResponse.json(
      {
        ok: failedCount === 0,
        message: messageParts.join(' '),
        results,
        counts: {
          created: createdCount,
          alreadyExists: duplicateCount,
          failed: failedCount,
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
