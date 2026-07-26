import type { NovaActionPlan, NovaProposedAction } from './types'

export type PreparedCalendarInsert = {
  actionId: string
  title: string
  description: string | null
  startAt: string
  endAt: string
  location: string | null
  attendees: string[]
  category: 'work' | 'personal' | 'family' | 'health' | 'social' | 'other'
  reminderMinutesBefore: number
  taskId: string | null
}

function params(action: NovaProposedAction): Record<string, string> {
  return Object.fromEntries(action.parameters.map((item) => [item.key, item.value]))
}

function validIso(value: string): boolean {
  return Boolean(value && !Number.isNaN(new Date(value).getTime()))
}

export function prepareCalendarInsert(action: NovaProposedAction, _plan: NovaActionPlan): PreparedCalendarInsert {
  const p = params(action)
  const title = (p.title || action.title || '').trim()
  const startAt = (p.start_at || '').trim()
  const endAt = (p.end_at || '').trim()
  if (!title) throw new Error('Le titre du rendez-vous est manquant.')
  if (!validIso(startAt) || !validIso(endAt)) throw new Error('La date ou l’heure du rendez-vous est incomplète.')
  if (new Date(endAt).getTime() <= new Date(startAt).getTime()) throw new Error('La fin du rendez-vous doit être après son début.')
  const allowed = new Set(['work','personal','family','health','social','other'])
  const category = allowed.has(p.category) ? p.category as PreparedCalendarInsert['category'] : 'other'
  const reminder = Number.parseInt(p.reminder_minutes_before || '0', 10)
  return {
    actionId: action.id,
    title,
    description: (p.description || '').trim() || null,
    startAt,
    endAt,
    location: (p.location || '').trim() || null,
    attendees: (p.attendees || '').split(',').map(v => v.trim()).filter(Boolean),
    category,
    reminderMinutesBefore: Number.isFinite(reminder) && reminder >= 0 ? reminder : 0,
    taskId: (p.task_id || '').trim() || null,
  }
}
