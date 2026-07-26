-- NOVAÉ V2 - Résolution sémantique et fusion atomique des tâches
-- À exécuter dans Supabase > SQL Editor avant de tester le patch.
-- Script idempotent : il peut être relancé.

ALTER TABLE public.todo_list
  ADD COLUMN IF NOT EXISTS merged_into_todo_id UUID
    REFERENCES public.todo_list(id) ON DELETE SET NULL;

ALTER TABLE public.todo_list
  ADD COLUMN IF NOT EXISTS merged_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_todo_list_merged_into
  ON public.todo_list(user_id, merged_into_todo_id)
  WHERE merged_into_todo_id IS NOT NULL;

COMMENT ON COLUMN public.todo_list.merged_into_todo_id IS
  'Tâche active conservée lorsqu’une tâche doublon est archivée après validation.';

COMMENT ON COLUMN public.todo_list.merged_at IS
  'Date de fusion validée par l’utilisatrice.';

CREATE OR REPLACE FUNCTION public.nova_merge_tasks(
  p_keep_task_id UUID,
  p_duplicate_task_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_keep public.todo_list%ROWTYPE;
  v_duplicate public.todo_list%ROWTYPE;
  v_moved INTEGER := 0;
  v_cancelled INTEGER := 0;
  v_internal_cancelled INTEGER := 0;
  v_merged_at TIMESTAMP WITH TIME ZONE := NOW();
  v_priority TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  IF p_keep_task_id = p_duplicate_task_id THEN
    RAISE EXCEPTION 'Une tâche ne peut pas être fusionnée avec elle-même';
  END IF;

  SELECT * INTO v_keep
  FROM public.todo_list
  WHERE id = p_keep_task_id AND user_id = v_user_id
  FOR UPDATE;

  SELECT * INTO v_duplicate
  FROM public.todo_list
  WHERE id = p_duplicate_task_id AND user_id = v_user_id
  FOR UPDATE;

  IF v_keep.id IS NULL OR v_duplicate.id IS NULL THEN
    RAISE EXCEPTION 'Tâche introuvable';
  END IF;

  IF v_duplicate.status = 'cancelled'
     AND v_duplicate.merged_into_todo_id = v_keep.id THEN
    RETURN jsonb_build_object(
      'already_merged', true,
      'kept_task_id', v_keep.id,
      'archived_task_id', v_duplicate.id,
      'reminders_moved', 0,
      'reminder_duplicates_cancelled', 0,
      'merged_at', v_duplicate.merged_at
    );
  END IF;

  IF v_keep.status NOT IN ('pending', 'in_progress') THEN
    RAISE EXCEPTION 'La tâche à conserver n’est plus active';
  END IF;

  IF v_duplicate.status NOT IN ('pending', 'in_progress') THEN
    RAISE EXCEPTION 'La tâche doublon n’est plus active';
  END IF;

  IF v_keep.due_date IS NOT NULL
     AND v_duplicate.due_date IS NOT NULL
     AND v_keep.due_date <> v_duplicate.due_date THEN
    RAISE EXCEPTION 'Les tâches ont des échéances différentes';
  END IF;

  v_priority := CASE
    WHEN COALESCE(v_keep.priority, 'medium') = 'urgent'
      OR COALESCE(v_duplicate.priority, 'medium') = 'urgent' THEN 'urgent'
    WHEN COALESCE(v_keep.priority, 'medium') = 'high'
      OR COALESCE(v_duplicate.priority, 'medium') = 'high' THEN 'high'
    WHEN COALESCE(v_keep.priority, 'medium') = 'medium'
      OR COALESCE(v_duplicate.priority, 'medium') = 'medium' THEN 'medium'
    ELSE 'low'
  END;

  -- Nettoyage des rappels déjà dupliqués à l’intérieur de la tâche à archiver.
  WITH ranked_duplicate_reminders AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY date_trunc('minute', scheduled_for)
        ORDER BY created_at ASC, id ASC
      ) AS duplicate_rank
    FROM public.task_reminders
    WHERE user_id = v_user_id
      AND todo_id = v_duplicate.id
      AND status = 'pending'
  )
  UPDATE public.task_reminders AS reminder
  SET
    status = 'cancelled',
    cancelled_at = v_merged_at,
    failure_reason = 'Rappel en doublon dans la tâche fusionnée',
    updated_at = v_merged_at
  FROM ranked_duplicate_reminders AS ranked
  WHERE reminder.id = ranked.id
    AND ranked.duplicate_rank > 1;
  GET DIAGNOSTICS v_internal_cancelled = ROW_COUNT;

  -- Les rappels identiques sur la même minute sont annulés, pas dupliqués.
  UPDATE public.task_reminders AS duplicate_reminder
  SET
    status = 'cancelled',
    cancelled_at = v_merged_at,
    failure_reason = 'Rappel en doublon lors de la fusion de tâches',
    updated_at = v_merged_at
  WHERE duplicate_reminder.user_id = v_user_id
    AND duplicate_reminder.todo_id = v_duplicate.id
    AND duplicate_reminder.status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.task_reminders AS kept_reminder
      WHERE kept_reminder.user_id = v_user_id
        AND kept_reminder.todo_id = v_keep.id
        AND kept_reminder.status IN ('pending', 'sent')
        AND date_trunc('minute', kept_reminder.scheduled_for)
          = date_trunc('minute', duplicate_reminder.scheduled_for)
    );
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;
  v_cancelled := v_cancelled + v_internal_cancelled;

  UPDATE public.task_reminders
  SET todo_id = v_keep.id, updated_at = v_merged_at
  WHERE user_id = v_user_id
    AND todo_id = v_duplicate.id
    AND status = 'pending';
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  UPDATE public.todo_list
  SET
    description = CASE
      WHEN NULLIF(BTRIM(v_keep.description), '') IS NULL
        THEN NULLIF(BTRIM(v_duplicate.description), '')
      WHEN NULLIF(BTRIM(v_duplicate.description), '') IS NULL
        OR BTRIM(v_keep.description) = BTRIM(v_duplicate.description)
        THEN v_keep.description
      WHEN POSITION(BTRIM(v_duplicate.description) IN v_keep.description) > 0
        THEN v_keep.description
      WHEN POSITION(BTRIM(v_keep.description) IN v_duplicate.description) > 0
        THEN v_duplicate.description
      ELSE LEFT(
        v_keep.description || E'\n\nInformation issue de la tâche fusionnée : '
        || v_duplicate.description,
        1500
      )
    END,
    category = COALESCE(v_keep.category, v_duplicate.category),
    project = COALESCE(v_keep.project, v_duplicate.project),
    tags = ARRAY(
      SELECT DISTINCT tag
      FROM unnest(COALESCE(v_keep.tags, '{}') || COALESCE(v_duplicate.tags, '{}')) AS tag
      WHERE NULLIF(BTRIM(tag), '') IS NOT NULL
      LIMIT 30
    ),
    priority = v_priority,
    due_date = COALESCE(v_keep.due_date, v_duplicate.due_date),
    due_time = COALESCE(v_keep.due_time, v_duplicate.due_time),
    estimated_duration_minutes = COALESCE(
      v_keep.estimated_duration_minutes,
      v_duplicate.estimated_duration_minutes
    ),
    updated_at = v_merged_at
  WHERE id = v_keep.id AND user_id = v_user_id;

  UPDATE public.todo_list
  SET
    status = 'cancelled',
    merged_into_todo_id = v_keep.id,
    merged_at = v_merged_at,
    updated_at = v_merged_at
  WHERE id = v_duplicate.id AND user_id = v_user_id;

  RETURN jsonb_build_object(
    'already_merged', false,
    'kept_task_id', v_keep.id,
    'archived_task_id', v_duplicate.id,
    'reminders_moved', v_moved,
    'reminder_duplicates_cancelled', v_cancelled,
    'merged_at', v_merged_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.nova_merge_tasks(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nova_merge_tasks(UUID, UUID) TO authenticated;
