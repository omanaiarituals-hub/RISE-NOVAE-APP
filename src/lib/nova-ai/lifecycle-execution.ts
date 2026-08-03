import type { NovaActionPlan, NovaLifecycleExecutionItem, NovaProposedAction } from './types'
import { parisMinutesFromIso } from './timezone'

type Db = any

type Params = Record<string, string>
function params(action: NovaProposedAction): Params {
  return Object.fromEntries(action.parameters.map((item) => [item.key, item.value]))
}
function nonEmpty(value?: string): string | null {
  const v = (value || '').trim()
  return v || null
}
function validIso(value: string): boolean {
  return Boolean(value && !Number.isNaN(new Date(value).getTime()))
}

async function readTask(db: Db, userId: string, taskId: string) {
  const { data, error } = await db.from('todo_list').select('*').eq('id', taskId).eq('user_id', userId).maybeSingle()
  if (error) throw new Error(`Impossible de lire la tâche : ${error.message}`)
  return data
}

async function readReminder(db: Db, userId: string, reminderId: string) {
  const { data, error } = await db.from('task_reminders').select('*').eq('id', reminderId).eq('user_id', userId).maybeSingle()
  if (error) throw new Error(`Impossible de lire le rappel : ${error.message}`)
  return data
}

async function readEvent(db: Db, userId: string, eventId: string) {
  const { data, error } = await db.from('planner_events').select('*').eq('id', eventId).eq('user_id', userId).maybeSingle()
  if (error) throw new Error(`Impossible de lire le rendez-vous : ${error.message}`)
  return data
}

export async function executeLifecycleAction(
  db: Db,
  userId: string,
  action: NovaProposedAction,
  _plan: NovaActionPlan
): Promise<NovaLifecycleExecutionItem> {
  const p = params(action)

  if (action.type === 'update_task') {
    const taskId = nonEmpty(p.task_id)
    if (!taskId) throw new Error('La tâche à modifier est introuvable.')
    const current = await readTask(db, userId, taskId)
    if (!current) throw new Error('La tâche à modifier est introuvable.')
    if (current.status === 'cancelled') throw new Error('Cette tâche est déjà annulée.')
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (nonEmpty(p.title)) updates.title = p.title.trim()
    if (p.description !== undefined && p.description !== '') updates.description = p.description.trim() || null
    if (p.due_date !== undefined && p.due_date !== '') updates.due_date = p.due_date.trim() || null
    if (p.due_time !== undefined && p.due_time !== '') updates.due_time = p.due_time.trim() || null
    if (nonEmpty(p.priority)) updates.priority = p.priority.trim()
    if (nonEmpty(p.category)) updates.category = p.category.trim()
    const { error } = await db.from('todo_list').update(updates).eq('id', taskId).eq('user_id', userId)
    if (error) throw new Error(`Impossible de modifier la tâche : ${error.message}`)
    const verified = await readTask(db, userId, taskId)
    if (!verified) throw new Error('La tâche a été modifiée mais sa vérification a échoué.')
    return { kind: 'task_update', actionId: action.id, status: 'updated', entityId: taskId, message: `C’est fait. J’ai modifié la tâche « ${verified.title} ».` }
  }

  if (action.type === 'complete_task') {
    const taskId = nonEmpty(p.task_id)
    if (!taskId) throw new Error('La tâche à clôturer est introuvable.')
    const current = await readTask(db, userId, taskId)
    if (!current) throw new Error('La tâche à clôturer est introuvable.')
    if (current.status === 'completed') return { kind: 'task_update', actionId: action.id, status: 'already_completed', entityId: taskId, message: `La tâche « ${current.title} » était déjà terminée.` }
    if (current.status === 'cancelled') throw new Error('Cette tâche est annulée et ne peut pas être marquée comme terminée.')
    const now = new Date().toISOString()
    const { error } = await db.from('todo_list').update({ status: 'completed', completed_at: now, updated_at: now }).eq('id', taskId).eq('user_id', userId)
    if (error) throw new Error(`Impossible de clôturer la tâche : ${error.message}`)
    await db.from('task_reminders').update({ status: 'cancelled', cancelled_at: now, updated_at: now, failure_reason: 'task_completed_by_user' }).eq('todo_id', taskId).eq('user_id', userId).eq('status', 'pending')
    const verified = await readTask(db, userId, taskId)
    if (!verified || verified.status !== 'completed') throw new Error('La tâche a été mise à jour mais sa clôture n’a pas pu être vérifiée.')
    return { kind: 'task_update', actionId: action.id, status: 'updated', entityId: taskId, message: `C’est fait. J’ai marqué la tâche « ${current.title} » comme terminée.` }
  }

  if (action.type === 'cancel_task') {
    const taskId = nonEmpty(p.task_id)
    if (!taskId) throw new Error('La tâche à annuler est introuvable.')
    const current = await readTask(db, userId, taskId)
    if (!current) throw new Error('La tâche à annuler est introuvable.')
    if (current.status === 'cancelled') return { kind: 'task_cancel', actionId: action.id, status: 'already_cancelled', entityId: taskId, message: `La tâche « ${current.title} » était déjà annulée.` }
    const now = new Date().toISOString()
    const { error } = await db.from('todo_list').update({ status: 'cancelled', updated_at: now }).eq('id', taskId).eq('user_id', userId)
    if (error) throw new Error(`Impossible d’annuler la tâche : ${error.message}`)
    await db.from('task_reminders').update({ status: 'cancelled', cancelled_at: now, updated_at: now, failure_reason: 'task_cancelled_by_user' }).eq('todo_id', taskId).eq('user_id', userId).eq('status', 'pending')
    return { kind: 'task_cancel', actionId: action.id, status: 'cancelled', entityId: taskId, message: `C’est fait. J’ai annulé la tâche « ${current.title} » et ses rappels encore actifs.` }
  }

  if (action.type === 'update_reminder') {
    const reminderId = nonEmpty(p.reminder_id)
    if (!reminderId) throw new Error('Le rappel à modifier est introuvable.')
    const current = await readReminder(db, userId, reminderId)
    if (!current) throw new Error('Le rappel à modifier est introuvable.')
    if (current.status !== 'pending') throw new Error('Seul un rappel encore en attente peut être modifié.')
    const scheduledFor = nonEmpty(p.scheduled_for)
    if (!scheduledFor || !validIso(scheduledFor)) throw new Error('La nouvelle date du rappel est incomplète.')
    const d = new Date(scheduledFor); d.setUTCSeconds(0,0)
    const { error } = await db.from('task_reminders').update({ scheduled_for: d.toISOString(), message: nonEmpty(p.message) || current.message, updated_at: new Date().toISOString() }).eq('id', reminderId).eq('user_id', userId)
    if (error) throw new Error(`Impossible de modifier le rappel : ${error.message}`)
    return { kind: 'reminder_update', actionId: action.id, status: 'updated', entityId: reminderId, message: `C’est fait. J’ai déplacé le rappel au ${new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',dateStyle:'full',timeStyle:'short'}).format(d)}.` }
  }

  if (action.type === 'cancel_reminder') {
    const reminderId = nonEmpty(p.reminder_id)
    if (!reminderId) throw new Error('Le rappel à annuler est introuvable.')
    const current = await readReminder(db, userId, reminderId)
    if (!current) throw new Error('Le rappel à annuler est introuvable.')
    if (current.status === 'cancelled') return { kind: 'reminder_cancel', actionId: action.id, status: 'already_cancelled', entityId: reminderId, message: 'Ce rappel était déjà annulé.' }
    const now = new Date().toISOString()
    const { error } = await db.from('task_reminders').update({ status: 'cancelled', cancelled_at: now, updated_at: now, failure_reason: 'cancelled_by_user' }).eq('id', reminderId).eq('user_id', userId)
    if (error) throw new Error(`Impossible d’annuler le rappel : ${error.message}`)
    return { kind: 'reminder_cancel', actionId: action.id, status: 'cancelled', entityId: reminderId, message: 'C’est fait. J’ai annulé ce rappel.' }
  }

  if (action.type === 'update_calendar_event') {
    const eventId = nonEmpty(p.event_id)
    if (!eventId) throw new Error('Le rendez-vous à modifier est introuvable.')
    const current = await readEvent(db, userId, eventId)
    if (!current) throw new Error('Le rendez-vous à modifier est introuvable.')
    if (current.status === 'cancelled') throw new Error('Ce rendez-vous est déjà annulé.')
    const startAt = nonEmpty(p.start_at) || current.start_date
    const endAt = nonEmpty(p.end_at) || current.end_date
    if (!validIso(startAt) || !validIso(endAt) || new Date(endAt) <= new Date(startAt)) throw new Error('Le nouvel horaire du rendez-vous est incomplet.')
    const { data: conflicts, error: conflictError } = await db.from('planner_events').select('id,title,start_date,end_date').eq('user_id', userId).neq('id', eventId).neq('status','cancelled').lt('start_date', endAt).gt('end_date', startAt).limit(5)
    if (conflictError) throw new Error(`Impossible de vérifier les conflits : ${conflictError.message}`)
    if ((conflicts || []).length > 0) throw new Error(`Le nouvel horaire chevauche « ${(conflicts || [])[0].title} ». Je n’ai rien modifié.`)
    const updates: Record<string, unknown> = {
      start_date: startAt, end_date: endAt,
      start_minutes: parisMinutesFromIso(startAt), end_minutes: parisMinutesFromIso(endAt),
      reminder_sent: false, updated_at: new Date().toISOString(),
    }
    if (nonEmpty(p.title)) updates.title = p.title.trim()
    if (p.location !== undefined && p.location !== '') updates.location = p.location.trim() || null
    if (p.attendees !== undefined && p.attendees !== '') updates.attendees = p.attendees.split(',').map(v=>v.trim()).filter(Boolean)
    if (nonEmpty(p.category)) updates.category = p.category.trim()
    if (p.reminder_minutes_before !== undefined && p.reminder_minutes_before !== '') {
      const mins = Number.parseInt(p.reminder_minutes_before,10)
      updates.reminder_minutes_before = Number.isFinite(mins) && mins > 0 ? [mins] : []
    }
    const { error } = await db.from('planner_events').update(updates).eq('id', eventId).eq('user_id', userId)
    if (error) throw new Error(`Impossible de modifier le rendez-vous : ${error.message}`)
    const verified = await readEvent(db, userId, eventId)
    return { kind: 'calendar_update', actionId: action.id, status: 'updated', entityId: eventId, message: `C’est fait. J’ai modifié « ${verified?.title || current.title} » dans ton planning.` }
  }

  if (action.type === 'cancel_calendar_event') {
    const eventId = nonEmpty(p.event_id)
    if (!eventId) throw new Error('Le rendez-vous à annuler est introuvable.')
    const current = await readEvent(db, userId, eventId)
    if (!current) throw new Error('Le rendez-vous à annuler est introuvable.')
    if (current.status === 'cancelled') return { kind: 'calendar_cancel', actionId: action.id, status: 'already_cancelled', entityId: eventId, message: `Le rendez-vous « ${current.title} » était déjà annulé.` }
    const { error } = await db.from('planner_events').update({ status: 'cancelled', reminder_sent: true, updated_at: new Date().toISOString() }).eq('id', eventId).eq('user_id', userId)
    if (error) throw new Error(`Impossible d’annuler le rendez-vous : ${error.message}`)
    return { kind: 'calendar_cancel', actionId: action.id, status: 'cancelled', entityId: eventId, message: `C’est fait. J’ai annulé le rendez-vous « ${current.title} ».` }
  }

  throw new Error('Cette modification n’est pas encore prise en charge.')
}
