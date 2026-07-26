-- NOVAÉ V2 - Rappels associés aux tâches
-- À exécuter une seule fois dans Supabase > SQL Editor.
-- Script idempotent : il peut être relancé sans recréer les objets existants.

CREATE TABLE IF NOT EXISTS public.task_reminders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  todo_id UUID NOT NULL REFERENCES public.todo_list(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  channel TEXT NOT NULL DEFAULT 'push_and_in_app'
    CHECK (channel IN ('push_and_in_app')),
  message TEXT,
  source TEXT NOT NULL DEFAULT 'nova',
  sent_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT task_reminders_unique_schedule UNIQUE (user_id, todo_id, scheduled_for)
);

ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own task reminders" ON public.task_reminders;
CREATE POLICY "Users can view own task reminders"
  ON public.task_reminders FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own task reminders" ON public.task_reminders;
CREATE POLICY "Users can insert own task reminders"
  ON public.task_reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own task reminders" ON public.task_reminders;
CREATE POLICY "Users can update own task reminders"
  ON public.task_reminders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own task reminders" ON public.task_reminders;
CREATE POLICY "Users can delete own task reminders"
  ON public.task_reminders FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_task_reminders_due
  ON public.task_reminders(status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_task_reminders_user_task
  ON public.task_reminders(user_id, todo_id);

DROP TRIGGER IF EXISTS handle_task_reminders_updated_at ON public.task_reminders;
CREATE TRIGGER handle_task_reminders_updated_at
  BEFORE UPDATE ON public.task_reminders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
