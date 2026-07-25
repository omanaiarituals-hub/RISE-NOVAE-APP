type SupabaseClientLike = {
  from: (table: string) => any
}

type AdministrativeDueDateStatus =
  | 'none'
  | 'upcoming'
  | 'today'
  | 'overdue'
  | 'unknown'

type AdministrativeReminderType =
  | 'before_7_days'
  | 'before_3_days'
  | 'before_1_day'
  | 'due_today'
  | 'overdue_1_day'
  | 'overdue_3_days'

type CreateAdministrativeDocumentRemindersParams = {
  supabase: SupabaseClientLike
  userId: string
  documentId: string
  dueDate: string | null | undefined
  dueDateStatus: AdministrativeDueDateStatus | string | null | undefined
}

const REMINDER_HOUR_UTC = 8

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const [yearRaw, monthRaw, dayRaw] = value.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)

  if (!year || !month || !day) return null

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function atReminderHour(date: Date): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    REMINDER_HOUR_UTC,
    0,
    0
  ))
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function buildReminderRows(params: CreateAdministrativeDocumentRemindersParams) {
  const due = parseDateOnly(params.dueDate)
  if (!due) return []

  const now = new Date()
  const minimumFutureDate = addMinutes(now, 10)

  const baseRows: Array<{
    reminder_type: AdministrativeReminderType
    scheduled_for: Date
  }> = [
    {
      reminder_type: 'before_7_days',
      scheduled_for: atReminderHour(addDays(due, -7)),
    },
    {
      reminder_type: 'before_3_days',
      scheduled_for: atReminderHour(addDays(due, -3)),
    },
    {
      reminder_type: 'before_1_day',
      scheduled_for: atReminderHour(addDays(due, -1)),
    },
    {
      reminder_type: 'due_today',
      scheduled_for: atReminderHour(due),
    },
    {
      reminder_type: 'overdue_1_day',
      scheduled_for: atReminderHour(addDays(due, 1)),
    },
    {
      reminder_type: 'overdue_3_days',
      scheduled_for: atReminderHour(addDays(due, 3)),
    },
  ]

  const futureRows = baseRows.filter((row) => row.scheduled_for > minimumFutureDate)

  if (futureRows.length > 0) {
    return futureRows
  }

  if (params.dueDateStatus === 'overdue') {
    return [
      {
        reminder_type: 'overdue_1_day' as AdministrativeReminderType,
        scheduled_for: addMinutes(now, 60),
      },
      {
        reminder_type: 'overdue_3_days' as AdministrativeReminderType,
        scheduled_for: addDays(now, 3),
      },
    ]
  }

  return []
}

export async function createAdministrativeDocumentReminders(
  params: CreateAdministrativeDocumentRemindersParams
) {
  if (!params.userId || !params.documentId) {
    return { created: 0, skipped: true }
  }

  if (
    !params.dueDate ||
    params.dueDateStatus === 'none' ||
    params.dueDateStatus === 'unknown'
  ) {
    return { created: 0, skipped: true }
  }

  const rows = buildReminderRows(params).map((row) => ({
    user_id: params.userId,
    document_id: params.documentId,
    reminder_type: row.reminder_type,
    scheduled_for: row.scheduled_for.toISOString(),
  }))

  if (rows.length === 0) {
    return { created: 0, skipped: true }
  }

  const { error } = await params.supabase
    .from('administrative_document_reminders')
    .insert(rows)

  if (error) {
    throw error
  }

  return {
    created: rows.length,
    skipped: false,
  }
}