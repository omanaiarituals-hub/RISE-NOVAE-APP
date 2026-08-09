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

function buildUserClient(supabaseUrl: string, anonKey: string, token: string) {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type MealRecipeIngredient = { name?: unknown; quantity?: unknown }

function parseMealQuantity(value: string): { value: number; unit: string } | null {
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/)
  if (!match) return null
  return { value: Number.parseFloat(match[1].replace(',', '.')), unit: match[2].trim().toLowerCase() }
}

function scaleMealQuantity(value: string, factor: number): string {
  if (!value || !Number.isFinite(factor) || factor === 1) return value
  const parsed = parseMealQuantity(value)
  if (!parsed) return value
  const scaled = parsed.value * factor
  const rounded = scaled % 1 === 0 ? scaled : Math.round(scaled * 10) / 10
  return parsed.unit ? `${rounded}${parsed.unit}` : String(rounded)
}

function mergeMealQuantities(values: string[]): string {
  if (values.length === 0) return ''
  if (values.length === 1) return values[0]
  const parsed = values.map(parseMealQuantity)
  if (!parsed.every(Boolean)) return values.join(' + ')
  const units = new Set(parsed.map((item) => item!.unit))
  if (units.size !== 1) return values.join(' + ')
  const total = parsed.reduce((sum, item) => sum + item!.value, 0)
  const unit = parsed[0]!.unit
  const formatted = total % 1 === 0 ? String(total) : total.toFixed(1)
  return unit ? `${formatted}${unit}` : formatted
}

async function syncMealShoppingList(db: ReturnType<typeof buildUserClient>, userId: string): Promise<void> {
  const { data: slots, error: slotsError } = await db
    .from('meal_plan')
    .select('recipe_id,headcount')
    .eq('user_id', userId)
    .not('recipe_id', 'is', null)

  if (slotsError) throw new Error(`Impossible de relire le planning repas : ${slotsError.message}`)

  const recipeIds = Array.from(new Set((slots || []).map((slot: any) => String(slot.recipe_id || '')).filter(Boolean)))

  const { error: deleteError } = await db
    .from('shopping_list')
    .delete()
    .eq('user_id', userId)
    .not('recipe_id', 'is', null)

  if (deleteError) throw new Error(`Impossible de recalculer les courses : ${deleteError.message}`)
  if (recipeIds.length === 0) return

  const { data: recipes, error: recipesError } = await db
    .from('recipes')
    .select('id,title,servings,ingredients')
    .eq('user_id', userId)
    .in('id', recipeIds)

  if (recipesError) throw new Error(`Impossible de relire les recettes : ${recipesError.message}`)

  const recipeById = new Map((recipes || []).map((recipe: any) => [String(recipe.id), recipe]))
  const grouped = new Map<string, { displayName: string; quantities: string[]; recipeId: string }>()

  for (const slot of slots || []) {
    const recipe = recipeById.get(String((slot as any).recipe_id))
    if (!recipe || !Array.isArray(recipe.ingredients)) continue
    const servings = Math.max(1, Number(recipe.servings) || 1)
    const headcount = Math.max(1, Number((slot as any).headcount) || servings)
    const factor = headcount / servings

    for (const rawIngredient of recipe.ingredients as MealRecipeIngredient[]) {
      const name = String(rawIngredient?.name || '').trim()
      if (!name) continue
      const quantity = String(rawIngredient?.quantity || '').trim()
      const key = name.toLocaleLowerCase('fr-FR')
      const current = grouped.get(key) || { displayName: name, quantities: [], recipeId: String(recipe.id) }
      current.quantities.push(scaleMealQuantity(quantity, factor))
      grouped.set(key, current)
    }
  }

  const now = new Date().toISOString()
  const rows = Array.from(grouped.values()).map((item) => ({
    user_id: userId,
    ingredient: item.displayName,
    quantity: mergeMealQuantities(item.quantities),
    recipe_id: item.recipeId,
    checked: false,
    in_stock: false,
    to_buy: true,
    created_at: now,
    updated_at: now,
  }))

  if (rows.length === 0) return
  const { error: insertError } = await db.from('shopping_list').insert(rows)
  if (insertError) throw new Error(`Impossible de reconstruire les courses : ${insertError.message}`)
}

async function resolveMealRecipe(
  db: ReturnType<typeof buildUserClient>,
  userId: string,
  recipeId: string,
  mealName: string
): Promise<{ id: string; title: string; servings: number; ingredients: unknown; steps: unknown }> {
  if (recipeId) {
    const { data, error } = await db
      .from('recipes')
      .select('id,title,servings,ingredients,steps')
      .eq('id', recipeId)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Cette recette n’existe plus dans Mes recettes.')
    return data as any
  }

  if (!mealName) throw new Error('La recette à planifier est manquante.')

  const { data, error } = await db
    .from('recipes')
    .select('id,title,servings,ingredients,steps')
    .eq('user_id', userId)
    .ilike('title', `%${mealName}%`)
    .limit(10)

  if (error) throw new Error(error.message)

  const normalized = mealName.trim().toLocaleLowerCase('fr-FR')
  const exact = (data || []).filter(
    (recipe: any) => String(recipe.title || '').trim().toLocaleLowerCase('fr-FR') === normalized
  )
  const candidates = exact.length > 0 ? exact : (data || [])

  if (candidates.length === 0) {
    throw new Error(`La recette « ${mealName} » n’existe pas encore dans Mes recettes. Crée-la d’abord, puis je pourrai la planifier.`)
  }
  if (candidates.length > 1) {
    throw new Error(`Plusieurs recettes correspondent à « ${mealName} ». Précise laquelle tu veux utiliser.`)
  }
  return candidates[0] as any
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

  // Un créneau court (≤ 15 min) est un rappel : il se superpose librement aux
  // événements existants (ex. 3 appels à passer pendant une plage de travail).
  // Seuls les vrais blocs de temps (> 15 min) sont protégés contre les chevauchements.
  const eventDurationMinutes =
    (new Date(event.endAt).getTime() - new Date(event.startAt).getTime()) / 60_000
  const isShortReminderSlot = eventDurationMinutes <= 15

  if (!isShortReminderSlot) {
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
      return { kind:'calendar_event', actionId:event.actionId, status:'conflict', event:null, conflicts:list, message:`Je n’ai rien ajouté : ce créneau chevauche « ${list[0].title} ». Modifie l’horaire ou choisis un autre moment.` }
    }
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
      ['update_task','complete_task','cancel_task','update_reminder','cancel_reminder','update_calendar_event','cancel_calendar_event'].includes(action.type)
    )
    const noteActions = confirmedActions.filter(
      (action) => action.type === 'save_note' && action.engine === 'notes'
    )
    const updateNoteActions = confirmedActions.filter(
      (action) => action.type === 'update_note' && action.engine === 'notes'
    )
    const deleteNoteActions = confirmedActions.filter(
      (action) => action.type === 'delete_note' && action.engine === 'notes'
    )
    const shoppingActions = confirmedActions.filter(
      (action) => action.type === 'add_shopping_item' && action.engine === 'meals'
    )
    const clearShoppingActions = confirmedActions.filter(
      (action) => action.type === 'clear_shopping_list' && action.engine === 'meals'
    )
    const mealActions = confirmedActions.filter(
      (action) => action.type === 'set_meal' && action.engine === 'meals'
    )
    const updateMealActions = confirmedActions.filter(
      (action) => action.type === 'update_meal' && action.engine === 'meals'
    )
    const deleteMealActions = confirmedActions.filter(
      (action) => action.type === 'delete_meal' && action.engine === 'meals'
    )
    const recipeActions = confirmedActions.filter(
      (action) => action.type === 'create_recipe' && action.engine === 'meals'
    )
    const routineActions = confirmedActions.filter(
      (action) => action.type === 'create_routine' && action.engine === 'routines'
    )
    const updateRoutineActions = confirmedActions.filter(
      (action) => action.type === 'update_routine' && action.engine === 'routines'
    )
    const deleteRoutineActions = confirmedActions.filter(
      (action) => action.type === 'delete_routine' && action.engine === 'routines'
    )
    const unsupportedActions = confirmedActions.filter(
      (action) =>
        !(
          (action.type === 'create_task' && action.engine === 'tasks') ||
          (action.type === 'create_reminder' && action.engine === 'notifications') ||
          (action.type === 'merge_tasks' && action.engine === 'tasks') ||
          (action.type === 'create_calendar_event' && action.engine === 'calendar') ||
          ['update_task','complete_task','cancel_task','update_reminder','cancel_reminder','update_calendar_event','cancel_calendar_event'].includes(action.type) ||
          (action.type === 'save_note' && action.engine === 'notes') ||
          (action.type === 'update_note' && action.engine === 'notes') ||
          (action.type === 'delete_note' && action.engine === 'notes') ||
          (action.type === 'add_shopping_item' && action.engine === 'meals') ||
          (action.type === 'clear_shopping_list' && action.engine === 'meals') ||
          (action.type === 'set_meal' && action.engine === 'meals') ||
          (action.type === 'update_meal' && action.engine === 'meals') ||
          (action.type === 'delete_meal' && action.engine === 'meals') ||
          (action.type === 'create_recipe' && action.engine === 'meals') ||
          (action.type === 'create_routine' && action.engine === 'routines') ||
          (action.type === 'update_routine' && action.engine === 'routines') ||
          (action.type === 'delete_routine' && action.engine === 'routines')
        )
    )

    if (taskActions.length + reminderActions.length + mergeActions.length + calendarActions.length + lifecycleActions.length + noteActions.length + updateNoteActions.length + deleteNoteActions.length + shoppingActions.length + clearShoppingActions.length + mealActions.length + updateMealActions.length + deleteMealActions.length + recipeActions.length + routineActions.length + updateRoutineActions.length + deleteRoutineActions.length === 0) {
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

    if (taskActions.length > 5 || reminderActions.length > 5 || mergeActions.length > 3 || calendarActions.length > 5 || lifecycleActions.length > 8 || noteActions.length > 10 || updateNoteActions.length > 10 || deleteNoteActions.length > 20 || shoppingActions.length > 20 || clearShoppingActions.length > 1 || mealActions.length > 10 || updateMealActions.length > 10 || deleteMealActions.length > 10 || recipeActions.length > 5 || routineActions.length > 5 || updateRoutineActions.length > 10 || deleteRoutineActions.length > 20) {
      return NextResponse.json({ error: 'Trop d’actions dans une seule validation.' }, { status: 400 })
    }

    type SimpleExecutionItem = {
      kind: 'note' | 'shopping_item' | 'meal' | 'recipe' | 'routine'
      actionId: string
      status: 'created' | 'already_exists' | 'failed' | 'updated' | 'cancelled'
      entityId: string | null
      message: string
    }
    const results: Array<
      NovaTaskExecutionItem | NovaReminderExecutionItem | NovaTaskMergeExecutionItem | NovaCalendarExecutionItem | NovaLifecycleExecutionItem | SimpleExecutionItem
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
        const kind = action.type === 'complete_task' || action.type.startsWith('update_task') ? 'task_update'
          : action.type.startsWith('cancel_task') ? 'task_cancel'
          : action.type.startsWith('update_reminder') ? 'reminder_update'
          : action.type.startsWith('cancel_reminder') ? 'reminder_cancel'
          : action.type.startsWith('update_calendar') ? 'calendar_update'
          : 'calendar_cancel'
        results.push({ kind, actionId: action.id, status: 'failed', entityId: null, message: error instanceof Error ? error.message : 'La modification n’a pas pu être exécutée.' } as NovaLifecycleExecutionItem)
      }
    }

    for (const action of noteActions) {
      try {
        const p = Object.fromEntries(action.parameters.map((item) => [item.key, item.value])) as Record<string, string>
        const content = typeof p.content === 'string' ? p.content.trim() : ''
        const title = typeof p.title === 'string' ? p.title.trim() : ''

        if (!content) {
          results.push({ kind: 'note', actionId: action.id, status: 'failed', entityId: null, message: 'La note est vide, je ne l’ai pas enregistrée.' })
          continue
        }

        const { data: existing, error: existingError } = await userClient
          .from('notes')
          .select('id,title,content')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(100)

        if (existingError) throw new Error(existingError.message)

        const normalizeNoteValue = (value: unknown) =>
          String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase('fr-FR')
            .replace(/\s+/g, ' ')
            .trim()

        const normalizedTitle = normalizeNoteValue(title)
        const normalizedContent = normalizeNoteValue(content)
        const duplicate = (existing || []).find((note: any) => {
          const sameContent = normalizeNoteValue(note.content) === normalizedContent
          const sameTitle = normalizedTitle && normalizeNoteValue(note.title) === normalizedTitle
          return sameContent || (sameTitle && normalizedContent && normalizeNoteValue(note.content).includes(normalizedContent))
        })

        if (duplicate) {
          results.push({
            kind: 'note',
            actionId: action.id,
            status: 'already_exists',
            entityId: duplicate.id,
            message: `Cette note existe déjà${duplicate.title ? ` : « ${duplicate.title} »` : ''}. Je n’ai pas créé de doublon.`,
          })
          continue
        }

        const now = new Date().toISOString()
        const { data: inserted, error } = await userClient
          .from('notes')
          .insert({ user_id: user.id, title: title || null, content, pinned: false, created_at: now, updated_at: now })
          .select('id,title,content,pinned')
          .single()

        if (error || !inserted?.id) throw new Error(error?.message || 'La note n’a pas pu être enregistrée.')

        const { data: verified, error: verifyError } = await userClient
          .from('notes')
          .select('id,title,content,pinned')
          .eq('id', inserted.id)
          .eq('user_id', user.id)
          .single()

        if (verifyError || !verified || verified.content !== content || (title && verified.title !== title)) {
          throw new Error(verifyError?.message || 'La note a été écrite mais sa vérification a échoué.')
        }

        results.push({
          kind: 'note',
          actionId: action.id,
          status: 'created',
          entityId: inserted.id,
          message: `C’est noté${title ? ` : « ${title} »` : ''}.`,
        })
      } catch (error) {
        results.push({ kind: 'note', actionId: action.id, status: 'failed', entityId: null, message: error instanceof Error ? error.message : 'La note n’a pas pu être enregistrée.' })
      }
    }

    for (const action of updateNoteActions) {
      try {
        const p = Object.fromEntries(action.parameters.map((item) => [item.key, item.value])) as Record<string, string>
        const noteId = String(p.note_id || '').trim()
        if (!noteId) {
          results.push({ kind: 'note', actionId: action.id, status: 'failed', entityId: null, message: 'La note à modifier n’a pas été identifiée avec certitude.' })
          continue
        }

        const { data: current, error: currentError } = await userClient
          .from('notes')
          .select('id,title,content,pinned')
          .eq('id', noteId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (currentError) throw new Error(currentError.message)
        if (!current) throw new Error('Cette note n’existe plus.')

        const changes: Record<string, unknown> = { updated_at: new Date().toISOString() }
        const titleProvided = typeof p.title === 'string' && p.title.trim() !== ''
        const contentProvided = typeof p.content === 'string' && p.content.trim() !== ''
        const pinnedProvided = p.pinned === 'true' || p.pinned === 'false'

        if (titleProvided) changes.title = p.title.trim()
        if (contentProvided) changes.content = p.content.trim()
        if (pinnedProvided) changes.pinned = p.pinned === 'true'

        if (!titleProvided && !contentProvided && !pinnedProvided) {
          results.push({ kind: 'note', actionId: action.id, status: 'failed', entityId: noteId, message: 'Aucune modification de note n’a été précisée.' })
          continue
        }

        const { data: updated, error } = await userClient
          .from('notes')
          .update(changes)
          .eq('id', noteId)
          .eq('user_id', user.id)
          .select('id,title,content,pinned')
          .single()

        if (error || !updated) throw new Error(error?.message || 'La note n’a pas pu être modifiée.')

        if (
          (titleProvided && updated.title !== p.title.trim()) ||
          (contentProvided && updated.content !== p.content.trim()) ||
          (pinnedProvided && updated.pinned !== (p.pinned === 'true'))
        ) {
          throw new Error('La note a été modifiée mais sa vérification a échoué.')
        }

        results.push({
          kind: 'note',
          actionId: action.id,
          status: 'updated',
          entityId: noteId,
          message: `C’est fait. La note « ${updated.title || current.title || 'Sans titre'} » a été mise à jour.`,
        })
      } catch (error) {
        results.push({ kind: 'note', actionId: action.id, status: 'failed', entityId: null, message: error instanceof Error ? error.message : 'La note n’a pas pu être modifiée.' })
      }
    }

    for (const action of deleteNoteActions) {
      try {
        const p = Object.fromEntries(action.parameters.map((item) => [item.key, item.value])) as Record<string, string>
        const noteId = String(p.note_id || '').trim()
        if (!noteId) {
          results.push({ kind: 'note', actionId: action.id, status: 'failed', entityId: null, message: 'La note à supprimer n’a pas été identifiée avec certitude.' })
          continue
        }

        const { data: current, error: currentError } = await userClient
          .from('notes')
          .select('id,title')
          .eq('id', noteId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (currentError) throw new Error(currentError.message)
        if (!current) {
          results.push({ kind: 'note', actionId: action.id, status: 'already_exists', entityId: noteId, message: 'Cette note n’existe déjà plus.' })
          continue
        }

        const { error: deleteError } = await userClient
          .from('notes')
          .delete()
          .eq('id', noteId)
          .eq('user_id', user.id)

        if (deleteError) throw new Error(deleteError.message)

        const { data: verified, error: verifyError } = await userClient
          .from('notes')
          .select('id')
          .eq('id', noteId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (verifyError) throw new Error(verifyError.message)
        if (verified) throw new Error('La note est toujours présente après la suppression.')

        results.push({
          kind: 'note',
          actionId: action.id,
          status: 'cancelled',
          entityId: noteId,
          message: `C’est fait. La note « ${current.title || 'Sans titre'} » a été supprimée.`,
        })
      } catch (error) {
        results.push({ kind: 'note', actionId: action.id, status: 'failed', entityId: null, message: error instanceof Error ? error.message : 'La note n’a pas pu être supprimée.' })
      }
    }

    for (const action of shoppingActions) {
      try {
        const p = Object.fromEntries(action.parameters.map((item) => [item.key, item.value])) as Record<string, string>
        const ingredient = typeof p.ingredient === 'string' ? p.ingredient.trim() : ''
        const quantity = typeof p.quantity === 'string' ? p.quantity.trim() : ''
        const unit = typeof p.unit === 'string' ? p.unit.trim() : ''

        if (!ingredient) {
          results.push({ kind: 'shopping_item', actionId: action.id, status: 'failed', entityId: null, message: 'Article manquant, rien n’a été ajouté à la liste.' })
          continue
        }

        // Garde anti-doublon sur les articles encore actifs à acheter.
        // L'article manuel n'a volontairement aucun recipe_id.
        const { data: existingItems, error: existingError } = await userClient
          .from('shopping_list')
          .select('id,ingredient,quantity,unit,to_buy')
          .eq('user_id', user.id)
          .eq('to_buy', true)
          .ilike('ingredient', ingredient)
          .limit(5)

        if (existingError) throw new Error(existingError.message)

        const normalizedIngredient = ingredient
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLocaleLowerCase('fr-FR')
          .replace(/\s+/g, ' ')
          .trim()

        const duplicate = (existingItems || []).find((item: any) => {
          const current = String(item.ingredient || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase('fr-FR')
            .replace(/\s+/g, ' ')
            .trim()
          return current === normalizedIngredient
        })

        if (duplicate) {
          results.push({
            kind: 'shopping_item',
            actionId: action.id,
            status: 'already_exists',
            entityId: duplicate.id,
            message: `${ingredient} est déjà dans ta liste de courses. Je n’ai pas créé de doublon.`,
          })
          continue
        }

        const now = new Date().toISOString()
        const { data: inserted, error } = await userClient
          .from('shopping_list')
          .insert({
            user_id: user.id,
            ingredient,
            quantity: quantity || null,
            unit: unit || null,
            recipe_id: null,
            checked: false,
            in_stock: false,
            to_buy: true,
            created_at: now,
            updated_at: now,
          })
          .select('id')
          .single()

        if (error || !inserted?.id) throw new Error(error?.message || 'L’article n’a pas pu être ajouté.')

        const { data: verified, error: verifyError } = await userClient
          .from('shopping_list')
          .select('id,ingredient,quantity,unit,recipe_id,to_buy')
          .eq('id', inserted.id)
          .eq('user_id', user.id)
          .single()

        if (
          verifyError ||
          !verified ||
          verified.ingredient !== ingredient ||
          verified.to_buy !== true ||
          verified.recipe_id !== null
        ) {
          throw new Error(verifyError?.message || 'L’article a été écrit mais sa présence dans la liste n’a pas pu être vérifiée.')
        }

        const label = [quantity, unit, ingredient].filter(Boolean).join(' ')
        results.push({
          kind: 'shopping_item',
          actionId: action.id,
          status: 'created',
          entityId: inserted.id,
          message: `Ajouté à ta liste de courses : ${label}.`,
        })
      } catch (error) {
        results.push({
          kind: 'shopping_item',
          actionId: action.id,
          status: 'failed',
          entityId: null,
          message: error instanceof Error ? error.message : 'L’article n’a pas pu être ajouté.',
        })
      }
    }

    for (const action of clearShoppingActions) {
      try {
        const { count, error: countError } = await userClient
          .from('shopping_list')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)

        if (countError) throw new Error(countError.message)

        const existingCount = Math.max(0, Number(count) || 0)

        if (existingCount === 0) {
          results.push({
            kind: 'shopping_item',
            actionId: action.id,
            status: 'cancelled',
            entityId: null,
            message: 'Ta liste de courses est déjà vide.',
          })
          continue
        }

        const { error: deleteError } = await userClient
          .from('shopping_list')
          .delete()
          .eq('user_id', user.id)

        if (deleteError) throw new Error(deleteError.message)

        const { count: remainingCount, error: verifyError } = await userClient
          .from('shopping_list')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)

        if (verifyError) throw new Error(verifyError.message)
        if ((Number(remainingCount) || 0) > 0) {
          throw new Error('La liste contient encore des articles après le vidage.')
        }

        results.push({
          kind: 'shopping_item',
          actionId: action.id,
          status: 'cancelled',
          entityId: null,
          message: `C’est fait. Ta liste de courses a été vidée (${existingCount} article${existingCount > 1 ? 's' : ''} supprimé${existingCount > 1 ? 's' : ''}).`,
        })
      } catch (error) {
        results.push({
          kind: 'shopping_item',
          actionId: action.id,
          status: 'failed',
          entityId: null,
          message: error instanceof Error ? error.message : 'La liste de courses n’a pas pu être vidée.',
        })
      }
    }

    for (const action of mealActions) {
      try {
        const p = Object.fromEntries(action.parameters.map((item) => [item.key, item.value])) as Record<string, string>
        const day = String(p.day || '').trim()
        const mealType = String(p.meal_type || '').trim()
        const mealName = String(p.meal_name || '').trim()
        const recipeIdParam = String(p.recipe_id || '').trim()
        const headcountRaw = Number.parseInt(String(p.headcount || ''), 10)

        if (!day || !mealType) {
          results.push({ kind: 'meal', actionId: action.id, status: 'failed', entityId: null, message: 'Il me manque le jour ou le créneau du repas.' })
          continue
        }
        if (!['petit_dejeuner', 'dejeuner', 'diner', 'collation'].includes(mealType)) {
          results.push({ kind: 'meal', actionId: action.id, status: 'failed', entityId: null, message: 'Le créneau demandé n’est pas valide.' })
          continue
        }

        const recipe = await resolveMealRecipe(userClient, user.id, recipeIdParam, mealName)
        if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length < 2 || !Array.isArray(recipe.steps) || recipe.steps.length < 2) {
          throw new Error(`La fiche « ${recipe.title} » est incomplète. Complète d’abord la recette avant de la planifier.`)
        }

        const now = new Date().toISOString()
        const headcount = Number.isFinite(headcountRaw) && headcountRaw > 0
          ? headcountRaw
          : Math.max(1, Number(recipe.servings) || 1)

        const { data: upserted, error } = await userClient
          .from('meal_plan')
          .upsert(
            {
              user_id: user.id,
              day_of_week: day,
              meal_type: mealType,
              recipe_id: recipe.id,
              custom_meal: recipe.title,
              meal_scope: ['foyer'],
              headcount,
              updated_at: now,
              created_at: now,
            },
            { onConflict: 'user_id,day_of_week,meal_type' }
          )
          .select('id')
          .single()

        if (error || !upserted?.id) throw new Error(error?.message || 'Le repas n’a pas pu être planifié.')

        const { data: verified, error: verifyError } = await userClient
          .from('meal_plan')
          .select('id,day_of_week,meal_type,recipe_id,headcount')
          .eq('id', upserted.id)
          .eq('user_id', user.id)
          .single()

        if (
          verifyError || !verified ||
          verified.day_of_week !== day ||
          verified.meal_type !== mealType ||
          verified.recipe_id !== recipe.id ||
          verified.headcount !== headcount
        ) {
          throw new Error(verifyError?.message || 'Le repas a été écrit mais sa vérification a échoué.')
        }

        await syncMealShoppingList(userClient, user.id)

        const slotLabel = mealType === 'diner' ? 'dîner' : mealType === 'dejeuner' ? 'déjeuner' : mealType === 'petit_dejeuner' ? 'petit-déjeuner' : 'collation'
        results.push({
          kind: 'meal', actionId: action.id, status: 'created', entityId: upserted.id,
          message: `C’est fait. « ${recipe.title} » est planifié pour le ${slotLabel} de ${day.toLowerCase()} pour ${headcount} personne${headcount > 1 ? 's' : ''}. La liste de courses a été recalculée automatiquement.`,
        })
      } catch (error) {
        results.push({ kind: 'meal', actionId: action.id, status: 'failed', entityId: null, message: error instanceof Error ? error.message : 'Le repas n’a pas pu être planifié.' })
      }
    }

    for (const action of updateMealActions) {
      try {
        const p = Object.fromEntries(action.parameters.map((item) => [item.key, item.value])) as Record<string, string>
        const mealId = String(p.meal_id || '').trim()
        if (!mealId) {
          results.push({ kind: 'meal', actionId: action.id, status: 'failed', entityId: null, message: 'Le repas à modifier n’a pas été identifié avec certitude.' })
          continue
        }

        const { data: current, error: currentError } = await userClient
          .from('meal_plan')
          .select('id,recipe_id,day_of_week,meal_type,headcount')
          .eq('id', mealId).eq('user_id', user.id).maybeSingle()

        if (currentError) throw new Error(currentError.message)
        if (!current) throw new Error('Ce repas n’existe plus dans le planning.')

        const recipeIdParam = String(p.recipe_id || '').trim()
        const mealName = String(p.meal_name || '').trim()
        const recipe = recipeIdParam || mealName
          ? await resolveMealRecipe(userClient, user.id, recipeIdParam, mealName)
          : await resolveMealRecipe(userClient, user.id, String(current.recipe_id || ''), '')

        const nextDay = String(p.day || '').trim() || String(current.day_of_week || '')
        const nextMealType = String(p.meal_type || '').trim() || String(current.meal_type || '')
        const headcountRaw = Number.parseInt(String(p.headcount || ''), 10)
        const nextHeadcount = Number.isFinite(headcountRaw) && headcountRaw > 0
          ? headcountRaw
          : Math.max(1, Number(current.headcount) || Number(recipe.servings) || 1)

        const { data: updated, error } = await userClient
          .from('meal_plan')
          .update({
            recipe_id: recipe.id,
            custom_meal: recipe.title,
            day_of_week: nextDay,
            meal_type: nextMealType,
            headcount: nextHeadcount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', mealId).eq('user_id', user.id)
          .select('id,recipe_id,day_of_week,meal_type,headcount').single()

        if (error || !updated) throw new Error(error?.message || 'Le repas n’a pas pu être modifié.')

        await syncMealShoppingList(userClient, user.id)

        results.push({
          kind: 'meal', actionId: action.id, status: 'updated', entityId: mealId,
          message: `C’est fait. Le repas est maintenant « ${recipe.title} » le ${nextDay.toLowerCase()} (${nextMealType}) pour ${nextHeadcount} personne${nextHeadcount > 1 ? 's' : ''}. Les courses ont été recalculées.`,
        })
      } catch (error) {
        results.push({ kind: 'meal', actionId: action.id, status: 'failed', entityId: null, message: error instanceof Error ? error.message : 'Le repas n’a pas pu être modifié.' })
      }
    }

    for (const action of deleteMealActions) {
      try {
        const p = Object.fromEntries(action.parameters.map((item) => [item.key, item.value])) as Record<string, string>
        const mealId = String(p.meal_id || '').trim()
        if (!mealId) {
          results.push({ kind: 'meal', actionId: action.id, status: 'failed', entityId: null, message: 'Le repas à supprimer n’a pas été identifié avec certitude.' })
          continue
        }

        const { data: current, error: currentError } = await userClient
          .from('meal_plan')
          .select('id,custom_meal,day_of_week,meal_type')
          .eq('id', mealId).eq('user_id', user.id).maybeSingle()

        if (currentError) throw new Error(currentError.message)
        if (!current) {
          results.push({ kind: 'meal', actionId: action.id, status: 'already_exists', entityId: mealId, message: 'Ce repas n’est déjà plus dans le planning.' })
          continue
        }

        const { error: deleteError } = await userClient
          .from('meal_plan')
          .delete().eq('id', mealId).eq('user_id', user.id)
        if (deleteError) throw new Error(deleteError.message)

        const { data: verified, error: verifyError } = await userClient
          .from('meal_plan')
          .select('id').eq('id', mealId).eq('user_id', user.id).maybeSingle()

        if (verifyError) throw new Error(verifyError.message)
        if (verified) throw new Error('Le repas est toujours présent après la suppression.')

        await syncMealShoppingList(userClient, user.id)

        results.push({
          kind: 'meal', actionId: action.id, status: 'cancelled', entityId: mealId,
          message: `C’est fait. ${current.custom_meal || 'Le repas'} du ${String(current.day_of_week || '').toLowerCase()} a été retiré du planning et les courses ont été recalculées.`,
        })
      } catch (error) {
        results.push({ kind: 'meal', actionId: action.id, status: 'failed', entityId: null, message: error instanceof Error ? error.message : 'Le repas n’a pas pu être supprimé.' })
      }
    }

    for (const action of recipeActions) {
      try {
        const p = Object.fromEntries(action.parameters.map((item) => [item.key, item.value])) as Record<string, string>
        const title = String(p.title || '').trim()
        const description = String(p.description || '').trim()
        const emoji = String(p.emoji || '🍽️').trim() || '🍽️'
        const prepTime = String(p.prep_time || '0').trim()
        const cookTime = String(p.cook_time || '0').trim()
        const category = String(p.category || 'express').trim()
        const mealType = String(p.meal_type || 'plat').trim()
        const difficulty = String(p.difficulty || 'facile').trim()
        const servings = Math.max(1, parseInt(String(p.servings || '4'), 10) || 4)
        const caloriesRaw = parseInt(String(p.calories || ''), 10)
        const calories = Number.isFinite(caloriesRaw) ? caloriesRaw : null

        const sourceName = String(p.source_name || '').trim()
        const sourceUrl = String(p.source_url || '').trim()
        const sourceRatingRaw = String(p.source_rating || '').trim()
        const sourceReviews = String(p.source_reviews || '').trim()

        let webSource: { name: string; url: string; rating: string; reviews?: string } | null = null
        if (sourceName || sourceUrl || sourceRatingRaw) {
          if (!sourceName || !sourceUrl || !sourceRatingRaw) {
            throw new Error(`La provenance web de « ${title || 'cette recette'} » est incomplète : source, URL et note sont obligatoires ensemble.`)
          }

          let parsedUrl: URL
          try {
            parsedUrl = new URL(sourceUrl)
          } catch {
            throw new Error(`L’URL source de « ${title || 'cette recette'} » est invalide.`)
          }
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            throw new Error(`L’URL source de « ${title || 'cette recette'} » doit être une URL web http(s).`)
          }

          const ratingMatch = sourceRatingRaw.replace(',', '.').match(/([0-5](?:\.\d+)?)\s*(?:\/\s*5)?/)
          const ratingValue = ratingMatch ? Number.parseFloat(ratingMatch[1]) : Number.NaN
          if (!Number.isFinite(ratingValue) || ratingValue < 0 || ratingValue > 5) {
            throw new Error(`La note source de « ${title || 'cette recette'} » est invalide.`)
          }

          webSource = {
            name: sourceName,
            url: parsedUrl.toString(),
            rating: `${ratingValue.toFixed(1)}/5`,
            ...(sourceReviews ? { reviews: sourceReviews } : {}),
          }
        }

        let ingredients: Array<{ name: string; quantity: string }>
        let steps: string[]
        try {
          const parsedIngredients = JSON.parse(String(p.ingredients_json || '[]'))
          const parsedSteps = JSON.parse(String(p.steps_json || '[]'))
          ingredients = Array.isArray(parsedIngredients)
            ? parsedIngredients.map((item) => ({
                name: String(item?.name || '').trim(),
                quantity: String(item?.quantity || '').trim(),
              })).filter((item) => item.name)
            : []
          steps = Array.isArray(parsedSteps)
            ? parsedSteps.map((item) => String(item || '').trim()).filter(Boolean)
            : []
        } catch {
          throw new Error(`La recette « ${title || 'sans titre'} » contient des ingrédients ou des étapes invalides.`)
        }

        if (!title || ingredients.length < 2 || steps.length < 2) {
          throw new Error('La fiche recette est incomplète : titre, ingrédients et étapes sont obligatoires.')
        }
        if (!['express','healthy','family','vegetarian','vegan','gourmet'].includes(category)) {
          throw new Error(`Catégorie invalide pour « ${title} ».`)
        }
        if (!['entree','plat','dessert','accompagnement','boisson'].includes(mealType)) {
          throw new Error(`Type de repas invalide pour « ${title} ».`)
        }
        if (!['facile','moyen','difficile'].includes(difficulty)) {
          throw new Error(`Difficulté invalide pour « ${title} ».`)
        }

        const { data: existingRows, error: existingError } = await userClient
          .from('recipes')
          .select('id,title,ingredients,steps,source')
          .eq('user_id', user.id)
          .ilike('title', title)
          .limit(1)
        if (existingError) throw new Error(existingError.message)

        const existing = (existingRows || [])[0] as { id:string; title:string; ingredients:unknown; steps:unknown; source?:string | null } | undefined
        const existingComplete = existing &&
          Array.isArray(existing.ingredients) && existing.ingredients.length >= 3 &&
          Array.isArray(existing.steps) && existing.steps.length >= 2

        const encodedSource = webSource
          ? `web:${JSON.stringify(webSource)}`
          : 'nova'

        if (existingComplete) {
          if (webSource && existing?.id) {
            const { data: enriched, error: enrichError } = await userClient
              .from('recipes')
              .update({ source: encodedSource, updated_at: new Date().toISOString() })
              .eq('id', existing.id)
              .eq('user_id', user.id)
              .select('id,source')
              .single()

            if (enrichError || !enriched?.id || enriched.source !== encodedSource) {
              throw new Error(enrichError?.message || `La provenance web de « ${existing.title} » n’a pas pu être enregistrée.`)
            }

            results.push({
              kind:'recipe',
              actionId:action.id,
              status:'updated',
              entityId:existing.id,
              message:`C’est fait. J’ai conservé la source ${webSource.name} et la note ${webSource.rating} sur la fiche « ${existing.title} ».`,
            })
            continue
          }

          results.push({ kind:'recipe', actionId:action.id, status:'already_exists', entityId:existing.id, message:`La recette « ${existing.title} » existe déjà avec ses ingrédients et ses étapes. Je n’ai pas créé de doublon.` })
          continue
        }

        const now = new Date().toISOString()
        const payloadRecipe = {
          title, description: description || null, emoji,
          prep_time: prepTime, cook_time: cookTime,
          category, meal_type: mealType, difficulty, servings,
          ingredients, steps, calories,
          is_favorite: false, is_public: false, source: encodedSource,
          updated_at: now,
        }

        let recipeId: string | null = null
        let status: 'created' | 'updated' = 'created'
        if (existing?.id) {
          const { data, error } = await userClient.from('recipes')
            .update(payloadRecipe).eq('id', existing.id).eq('user_id', user.id).select('id').single()
          if (error || !data?.id) throw new Error(error?.message || 'La recette incomplète n’a pas pu être complétée.')
          recipeId = data.id
          status = 'updated'
        } else {
          const { data, error } = await userClient.from('recipes')
            .insert({ ...payloadRecipe, user_id:user.id, created_at:now }).select('id').single()
          if (error || !data?.id) throw new Error(error?.message || 'La recette n’a pas pu être créée.')
          recipeId = data.id
        }

        const { data: verified, error: verifyError } = await userClient.from('recipes')
          .select('id,title,servings,ingredients,steps,source').eq('id', recipeId).eq('user_id', user.id).single()
        if (verifyError || !verified || verified.title !== title ||
            !Array.isArray(verified.ingredients) || verified.ingredients.length !== ingredients.length ||
            !Array.isArray(verified.steps) || verified.steps.length !== steps.length ||
            verified.servings !== servings ||
            (webSource && verified.source !== encodedSource)) {
          throw new Error(`La recette « ${title} » a été écrite mais sa fiche complète n’a pas pu être vérifiée.`)
        }

        results.push({
          kind:'recipe', actionId:action.id, status, entityId:recipeId,
          message: status === 'updated'
            ? `C’est fait. J’ai complété la fiche « ${title} » dans Mes recettes.`
            : `C’est fait. J’ai créé la fiche complète « ${title} » pour ${servings} personnes dans Mes recettes.`
        })
      } catch (error) {
        results.push({ kind:'recipe', actionId:action.id, status:'failed', entityId:null, message:error instanceof Error ? error.message : 'La recette n’a pas pu être créée.' })
      }
    }


    for (const action of routineActions) {
      try {
        const p = Object.fromEntries(action.parameters.map((item) => [item.key, item.value])) as Record<string, string>
        const title = typeof p.title === 'string' ? p.title.trim() : ''
        const category = p.category === 'evening' ? 'evening' : 'morning'
        const allowedDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
        const days = String(p.days || '')
          .split(',')
          .map((day) => day.trim().toLowerCase())
          .filter((day, index, values) => allowedDays.includes(day) && values.indexOf(day) === index)
        const preferredTime = String(p.preferred_time || '').trim()
        const durationMinutes = Number.parseInt(String(p.duration_minutes || '15'), 10)
        const reminderEnabled = String(p.reminder_enabled || 'true').toLowerCase() !== 'false'
        const reminderMinutesBefore = Number.parseInt(String(p.reminder_minutes_before || '15'), 10)
        const emoji = typeof p.emoji === 'string' && p.emoji.trim() ? p.emoji.trim() : '✨'

        if (!title) {
          results.push({ kind: 'routine', actionId: action.id, status: 'failed', entityId: null, message: 'Le nom de la routine est manquant.' })
          continue
        }
        if (days.length === 0) {
          results.push({ kind: 'routine', actionId: action.id, status: 'failed', entityId: null, message: 'Les jours de la routine sont manquants.' })
          continue
        }
        if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(preferredTime)) {
          results.push({ kind: 'routine', actionId: action.id, status: 'failed', entityId: null, message: 'L’heure de la routine est invalide.' })
          continue
        }
        if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 240) {
          results.push({ kind: 'routine', actionId: action.id, status: 'failed', entityId: null, message: 'La durée de la routine doit être comprise entre 5 et 240 minutes.' })
          continue
        }

        const frequency = days.length === 7 ? 'daily' : 'custom'
        const customDays = `{${days.join(',')}}`

        const { data: existingRows, error: existingError } = await userClient
          .from('routines')
          .select('id,title,preferred_time,frequency,custom_days')
          .eq('user_id', user.id)
          .ilike('title', title)
          .limit(10)

        if (existingError) throw new Error(existingError.message)

        const duplicate = (existingRows || []).find((row: any) =>
          String(row.title || '').trim().toLocaleLowerCase('fr-FR') === title.toLocaleLowerCase('fr-FR') &&
          String(row.preferred_time || '').slice(0, 5) === preferredTime
        )

        if (duplicate?.id) {
          results.push({
            kind: 'routine',
            actionId: action.id,
            status: 'already_exists',
            entityId: duplicate.id,
            message: `La routine « ${title} » existe déjà à ${preferredTime}. Je n’ai pas créé de doublon.`,
          })
          continue
        }

        const now = new Date().toISOString()
        const { data: inserted, error } = await userClient
          .from('routines')
          .insert({
            user_id: user.id,
            title,
            description: emoji,
            category,
            frequency,
            custom_days: customDays,
            completed: false,
            streak_count: 0,
            reminder_enabled: reminderEnabled,
            reminder_minutes_before: Number.isFinite(reminderMinutesBefore) ? Math.max(0, reminderMinutesBefore) : 15,
            preferred_time: preferredTime,
            duration_minutes: durationMinutes,
            created_at: now,
            updated_at: now,
          })
          .select('id')
          .single()

        if (error || !inserted?.id) throw new Error(error?.message || 'La routine n’a pas pu être créée.')

        const { data: verified, error: verifyError } = await userClient
          .from('routines')
          .select('id,title,category,frequency,custom_days,preferred_time,duration_minutes,reminder_enabled')
          .eq('id', inserted.id)
          .eq('user_id', user.id)
          .single()

        if (
          verifyError ||
          !verified ||
          verified.title !== title ||
          verified.category !== category ||
          String(verified.preferred_time || '').slice(0, 5) !== preferredTime ||
          verified.duration_minutes !== durationMinutes
        ) {
          throw new Error(verifyError?.message || 'La routine a été écrite mais sa vérification a échoué.')
        }

        results.push({
          kind: 'routine',
          actionId: action.id,
          status: 'created',
          entityId: inserted.id,
          message: `C’est fait. Ta routine « ${title} » est programmée à ${preferredTime} et apparaîtra automatiquement dans ton Planner.`,
        })
      } catch (error) {
        results.push({
          kind: 'routine',
          actionId: action.id,
          status: 'failed',
          entityId: null,
          message: error instanceof Error ? error.message : 'La routine n’a pas pu être créée.',
        })
      }
    }


    for (const action of updateRoutineActions) {
      try {
        const p = Object.fromEntries(action.parameters.map((item) => [item.key, item.value])) as Record<string, string>
        const routineId = typeof p.routine_id === 'string' ? p.routine_id.trim() : ''

        if (!routineId) {
          results.push({
            kind: 'routine',
            actionId: action.id,
            status: 'failed',
            entityId: null,
            message: 'La routine à modifier n’a pas pu être identifiée avec certitude.',
          })
          continue
        }

        const { data: current, error: readError } = await userClient
          .from('routines')
          .select('id,title,description,category,frequency,custom_days,preferred_time,duration_minutes,reminder_enabled,reminder_minutes_before')
          .eq('id', routineId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (readError) throw new Error(readError.message)
        if (!current) {
          results.push({
            kind: 'routine',
            actionId: action.id,
            status: 'failed',
            entityId: null,
            message: 'La routine à modifier est introuvable.',
          })
          continue
        }

        const updates: Record<string, unknown> = {}
        const title = String(p.title || '').trim()
        const category = String(p.category || '').trim()
        const daysRaw = String(p.days || '').trim()
        const preferredTime = String(p.preferred_time || '').trim()
        const durationRaw = String(p.duration_minutes || '').trim()
        const reminderEnabledRaw = String(p.reminder_enabled || '').trim().toLowerCase()
        const reminderMinutesRaw = String(p.reminder_minutes_before || '').trim()
        const emoji = String(p.emoji || '').trim()

        if (title) updates.title = title

        if (category) {
          if (!['morning', 'evening'].includes(category)) {
            throw new Error('Le moment de la routine doit être morning ou evening.')
          }
          updates.category = category
        }

        if (daysRaw) {
          const allowedDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
          const days = daysRaw
            .split(',')
            .map((day) => day.trim().toLowerCase())
            .filter((day, index, values) => allowedDays.includes(day) && values.indexOf(day) === index)

          if (days.length === 0) throw new Error('Les nouveaux jours de la routine sont invalides.')
          updates.frequency = days.length === 7 ? 'daily' : 'custom'
          updates.custom_days = `{${days.join(',')}}`
        }

        if (preferredTime) {
          if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(preferredTime)) {
            throw new Error('La nouvelle heure de la routine est invalide.')
          }
          updates.preferred_time = preferredTime
        }

        if (durationRaw) {
          const durationMinutes = Number.parseInt(durationRaw, 10)
          if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 240) {
            throw new Error('La durée de la routine doit être comprise entre 5 et 240 minutes.')
          }
          updates.duration_minutes = durationMinutes
        }

        if (reminderEnabledRaw) {
          if (!['true', 'false'].includes(reminderEnabledRaw)) {
            throw new Error('Le réglage du rappel doit être true ou false.')
          }
          updates.reminder_enabled = reminderEnabledRaw === 'true'
        }

        if (reminderMinutesRaw) {
          const reminderMinutesBefore = Number.parseInt(reminderMinutesRaw, 10)
          if (!Number.isFinite(reminderMinutesBefore) || reminderMinutesBefore < 0 || reminderMinutesBefore > 1440) {
            throw new Error('Le délai du rappel doit être compris entre 0 et 1440 minutes.')
          }
          updates.reminder_minutes_before = reminderMinutesBefore
        }

        if (emoji) updates.description = emoji

        if (Object.keys(updates).length === 0) {
          results.push({
            kind: 'routine',
            actionId: action.id,
            status: 'failed',
            entityId: routineId,
            message: `Aucune modification n’a été demandée pour la routine « ${current.title} ».`,
          })
          continue
        }

        updates.updated_at = new Date().toISOString()

        const { data: updated, error: updateError } = await userClient
          .from('routines')
          .update(updates)
          .eq('id', routineId)
          .eq('user_id', user.id)
          .select('id,title,description,category,frequency,custom_days,preferred_time,duration_minutes,reminder_enabled,reminder_minutes_before')
          .single()

        if (updateError || !updated) {
          throw new Error(updateError?.message || 'La routine n’a pas pu être modifiée.')
        }

        results.push({
          kind: 'routine',
          actionId: action.id,
          status: 'updated',
          entityId: updated.id,
          message: `C’est fait. La routine « ${updated.title} » a été modifiée${updated.preferred_time ? ` et est maintenant prévue à ${String(updated.preferred_time).slice(0, 5)}` : ''}.`,
        })
      } catch (error) {
        results.push({
          kind: 'routine',
          actionId: action.id,
          status: 'failed',
          entityId: null,
          message: error instanceof Error ? error.message : 'La routine n’a pas pu être modifiée.',
        })
      }
    }


    for (const action of deleteRoutineActions) {
      try {
        const p = Object.fromEntries(action.parameters.map((item) => [item.key, item.value])) as Record<string, string>
        const routineId = typeof p.routine_id === 'string' ? p.routine_id.trim() : ''
        const title = typeof p.title === 'string' ? p.title.trim() : ''
        const preferredTime = typeof p.preferred_time === 'string' ? p.preferred_time.trim() : ''

        if (!routineId && !title) {
          results.push({
            kind: 'routine',
            actionId: action.id,
            status: 'failed',
            entityId: null,
            message: 'Le nom de la routine à supprimer est manquant.',
          })
          continue
        }

        let query = userClient
          .from('routines')
          .select('id,title,preferred_time')
          .eq('user_id', user.id)
          .limit(10)

        if (routineId) {
          query = query.eq('id', routineId)
        } else {
          query = query.ilike('title', `%${title}%`)
          if (preferredTime && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(preferredTime)) {
            query = query.eq('preferred_time', preferredTime)
          }
        }

        const { data: matches, error: searchError } = await query

        if (searchError) throw new Error(searchError.message)

        const normalizedTitle = title.toLocaleLowerCase('fr-FR')
        const exactMatches = routineId
          ? (matches || [])
          : (matches || []).filter(
              (row: any) => String(row.title || '').trim().toLocaleLowerCase('fr-FR') === normalizedTitle
            )
        const candidates = exactMatches.length > 0 ? exactMatches : (matches || [])

        if (candidates.length === 0) {
          results.push({
            kind: 'routine',
            actionId: action.id,
            status: 'failed',
            entityId: null,
            message: `Je n’ai trouvé aucune routine correspondant à « ${title} ».`,
          })
          continue
        }

        if (candidates.length > 1) {
          const details = candidates
            .map((row: any) => `${row.title}${row.preferred_time ? ` à ${String(row.preferred_time).slice(0, 5)}` : ''}`)
            .join(', ')

          results.push({
            kind: 'routine',
            actionId: action.id,
            status: 'failed',
            entityId: null,
            message: `Plusieurs routines correspondent : ${details}. Précise celle que tu veux supprimer.`,
          })
          continue
        }

        const target = candidates[0] as any

        const { error: deleteError } = await userClient
          .from('routines')
          .delete()
          .eq('id', target.id)
          .eq('user_id', user.id)

        if (deleteError) throw new Error(deleteError.message)

        const { data: verified, error: verifyError } = await userClient
          .from('routines')
          .select('id')
          .eq('id', target.id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (verifyError) throw new Error(verifyError.message)
        if (verified) throw new Error('La routine est toujours présente après la suppression.')

        results.push({
          kind: 'routine',
          actionId: action.id,
          status: 'cancelled',
          entityId: target.id,
          message: `C’est fait. La routine « ${target.title} » a été supprimée et n’apparaîtra plus dans le Planner.`,
        })
      } catch (error) {
        results.push({
          kind: 'routine',
          actionId: action.id,
          status: 'failed',
          entityId: null,
          message: error instanceof Error ? error.message : 'La routine n’a pas pu être supprimée.',
        })
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
    const notesCreated = results.filter((item) => item.kind === 'note' && item.status === 'created').length
    const notesUpdated = results.filter((item) => item.kind === 'note' && item.status === 'updated').length
    const notesDeleted = results.filter((item) => item.kind === 'note' && item.status === 'cancelled').length
    const shoppingCreated = results.filter((item) => item.kind === 'shopping_item' && item.status === 'created').length
    const mealsPlanned = results.filter((item) => item.kind === 'meal' && item.status === 'created').length
    const mealsUpdated = results.filter((item) => item.kind === 'meal' && item.status === 'updated').length
    const mealsDeleted = results.filter((item) => item.kind === 'meal' && item.status === 'cancelled').length
    const recipesCreated = results.filter((item) => item.kind === 'recipe' && item.status === 'created').length
    const recipesUpdated = results.filter((item) => item.kind === 'recipe' && item.status === 'updated').length
    const routinesCreated = results.filter((item) => item.kind === 'routine' && item.status === 'created').length
    const routinesUpdated = results.filter((item) => item.kind === 'routine' && item.status === 'updated').length
    const routinesDeleted = results.filter((item) => item.kind === 'routine' && item.status === 'cancelled').length
    const failed = results.filter((item) => item.status === 'failed' || item.status === 'conflict').length

    const messageParts = results.map((item) => item.message)
    if (unsupportedActions.length > 0) {
      messageParts.push('Les autres actions proposées ne sont pas encore exécutées dans ce laboratoire.')
    }

    const httpStatus = tasksCreated + remindersScheduled + tasksMerged + calendarEventsCreated + actionsUpdated + actionsCancelled + alreadyExists + notesCreated + shoppingCreated + mealsPlanned + mealsUpdated + mealsDeleted + recipesCreated + recipesUpdated + routinesCreated + routinesUpdated + routinesDeleted > 0 ? 200 : (results.some(item => item.status === 'conflict') ? 409 : 500)
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
          notesCreated,
          notesUpdated,
          notesDeleted,
          recipesCreated,
          recipesUpdated,
          routinesCreated,
          routinesUpdated,
          routinesDeleted,
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
