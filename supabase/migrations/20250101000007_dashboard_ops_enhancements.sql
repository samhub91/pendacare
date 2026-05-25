-- Dashboard ops: visit timestamps (EVV-style) + unread message index

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS started_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_unread_receiver
  ON public.messages (receiver_id)
  WHERE read_at IS NULL;
