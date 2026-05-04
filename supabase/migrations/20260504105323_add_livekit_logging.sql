CREATE TABLE IF NOT EXISTS public.livekit_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  peer_user_id uuid,
  room_id text,
  ip text,
  status text,
  status_code int,
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_livekit_logs_user ON public.livekit_request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_livekit_logs_created_at ON public.livekit_request_logs(created_at);

ALTER TABLE public.livekit_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access"
ON public.livekit_request_logs
FOR ALL
USING (false);
