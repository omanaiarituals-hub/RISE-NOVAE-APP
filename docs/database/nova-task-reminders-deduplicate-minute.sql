-- NOVAÉ V2 - Nettoyage des rappels dupliqués dans une même minute
-- À exécuter une fois dans Supabase > SQL Editor AVANT de retester.
-- La ligne la plus ancienne est conservée. Les autres doublons sont supprimés.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        user_id,
        todo_id,
        DATE_TRUNC('minute', scheduled_for AT TIME ZONE 'UTC')
      ORDER BY
        CASE WHEN status = 'sent' THEN 0 ELSE 1 END,
        created_at ASC,
        id ASC
    ) AS duplicate_rank
  FROM public.task_reminders
  WHERE status IN ('pending', 'sent')
)
DELETE FROM public.task_reminders AS reminder
USING ranked
WHERE reminder.id = ranked.id
  AND ranked.duplicate_rank > 1;

-- Contrôle : cette requête doit retourner zéro ligne.
SELECT
  user_id,
  todo_id,
  DATE_TRUNC('minute', scheduled_for AT TIME ZONE 'UTC') AS scheduled_minute_utc,
  COUNT(*) AS reminder_count
FROM public.task_reminders
WHERE status IN ('pending', 'sent')
GROUP BY user_id, todo_id, DATE_TRUNC('minute', scheduled_for AT TIME ZONE 'UTC')
HAVING COUNT(*) > 1;
