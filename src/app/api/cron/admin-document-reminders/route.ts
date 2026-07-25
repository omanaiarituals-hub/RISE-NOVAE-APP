import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/push/notify'

export const runtime = 'nodejs'
export const maxDuration = 60

type ReminderRow = {
  id: string
  user_id: string
  document_id: string
  reminder_type: string
  scheduled_for: string
}

type DocumentRow = {
  id: string
  title: string | null
  sender: string | null
  due_date: string | null
  due_date_status: string | null
  processing_status: 'todo' | 'in_progress' | 'done' | null
  vault_protected: boolean | null
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function formatDueDate(date: string | null): string {
  if (!date) return 'date non précisée'

  try {
    return new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR')
  } catch {
    return date
  }
}

function buildNotificationText(reminder: ReminderRow, document: DocumentRow) {
  const title = document.title || 'Document administratif'
  const sender = document.sender ? ` de ${document.sender}` : ''
  const dueDate = formatDueDate(document.due_date)

  if (reminder.reminder_type === 'before_7_days') {
    return {
      title: '📄 Échéance administrative dans 7 jours',
      body: `${title}${sender} : à traiter avant le ${dueDate}.`,
    }
  }

  if (reminder.reminder_type === 'before_3_days') {
    return {
      title: '⏳ Échéance administrative proche',
      body: `${title}${sender} : il reste environ 3 jours avant le ${dueDate}.`,
    }
  }

  if (reminder.reminder_type === 'before_1_day') {
    return {
      title: '⚠️ Échéance administrative demain',
      body: `${title}${sender} : à vérifier avant demain.`,
    }
  }

  if (reminder.reminder_type === 'due_today') {
    return {
      title: '🚨 Échéance administrative aujourd’hui',
      body: `${title}${sender} : c’est à traiter aujourd’hui.`,
    }
  }

  if (reminder.reminder_type === 'overdue_1_day') {
    return {
      title: '🚨 Échéance administrative dépassée',
      body: `${title}${sender} : la date limite du ${dueDate} semble dépassée. À vérifier rapidement.`,
    }
  }

  return {
    title: '🚨 Relance administrative urgente',
    body: `${title}${sender} : ce document semble toujours non traité après échéance.`,
  }
}

async function markReminderSkipped(
  reminderId: string,
  reason: string
) {
  await supabaseAdmin
    .from('administrative_document_reminders')
    .update({
      skipped_at: new Date().toISOString(),
      skip_reason: reason,
    })
    .eq('id', reminderId)
}

async function markReminderSent(reminderId: string) {
  await supabaseAdmin
    .from('administrative_document_reminders')
    .update({
      sent_at: new Date().toISOString(),
    })
    .eq('id', reminderId)
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: 'Non autorisé' },
      { status: 401 }
    )
  }

  const now = new Date().toISOString()

  const { data: reminders, error: remindersError } = await supabaseAdmin
    .from('administrative_document_reminders')
    .select('id, user_id, document_id, reminder_type, scheduled_for')
    .lte('scheduled_for', now)
    .is('sent_at', null)
    .is('skipped_at', null)
    .order('scheduled_for', { ascending: true })
    .limit(50)

  if (remindersError) {
    console.error('[admin reminders cron] reminders query failed', remindersError)

    return NextResponse.json(
      { error: 'Impossible de charger les rappels administratifs.' },
      { status: 500 }
    )
  }

  const dueReminders = (reminders || []) as ReminderRow[]

  if (dueReminders.length === 0) {
    return NextResponse.json({
      success: true,
      processed: 0,
      sent: 0,
      skipped: 0,
    })
  }

  const documentIds = Array.from(new Set(dueReminders.map((reminder) => reminder.document_id)))

  const { data: documents, error: documentsError } = await supabaseAdmin
    .from('administrative_documents')
    .select('id, title, sender, due_date, due_date_status, processing_status, vault_protected')
    .in('id', documentIds)

  if (documentsError) {
    console.error('[admin reminders cron] documents query failed', documentsError)

    return NextResponse.json(
      { error: 'Impossible de charger les documents administratifs.' },
      { status: 500 }
    )
  }

  const documentsById = new Map<string, DocumentRow>()

  ;((documents || []) as DocumentRow[]).forEach((document) => {
    documentsById.set(document.id, document)
  })

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const reminder of dueReminders) {
    try {
      const document = documentsById.get(reminder.document_id)

      if (!document) {
        await markReminderSkipped(reminder.id, 'document_missing')
        skipped++
        continue
      }

      if (document.processing_status === 'done') {
        await markReminderSkipped(reminder.id, 'document_done')
        skipped++
        continue
      }

      const notification = buildNotificationText(reminder, document)

      await notifyUser({
        userId: reminder.user_id,
        type: 'admin_document_reminder',
        title: notification.title,
        body: notification.body,
        url: '/admin-documents',
        icon: '/novae-icon.svg',
        metadata: {
          documentId: reminder.document_id,
          reminderId: reminder.id,
          reminderType: reminder.reminder_type,
          vaultProtected: Boolean(document.vault_protected),
        },
      })

      await markReminderSent(reminder.id)
      sent++
    } catch (error) {
      console.error('[admin reminders cron] reminder failed', reminder.id, error)
      failed++
    }
  }

  return NextResponse.json({
    success: true,
    processed: dueReminders.length,
    sent,
    skipped,
    failed,
  })
}