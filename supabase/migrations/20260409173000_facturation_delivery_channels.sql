CREATE TABLE IF NOT EXISTS public.fact_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.fact_documents(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  recipient TEXT NOT NULL,
  subject TEXT,
  message_body TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  provider_name TEXT,
  provider_message_id TEXT,
  error_message TEXT,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS fact_delivery_logs_document_idx
  ON public.fact_delivery_logs(document_id, created_at DESC);

ALTER TABLE public.fact_delivery_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage fact delivery logs" ON public.fact_delivery_logs;
CREATE POLICY "Authenticated users can manage fact delivery logs"
ON public.fact_delivery_logs
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.fact_queue_delivery(
  p_document_id UUID,
  p_channel TEXT,
  p_recipient TEXT,
  p_subject TEXT DEFAULT NULL,
  p_message_body TEXT DEFAULT NULL
)
RETURNS public.fact_delivery_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_delivery public.fact_delivery_logs;
BEGIN
  INSERT INTO public.fact_delivery_logs (
    document_id,
    channel,
    recipient,
    subject,
    message_body,
    status,
    created_by
  )
  VALUES (
    p_document_id,
    p_channel,
    p_recipient,
    p_subject,
    p_message_body,
    'queued',
    auth.uid()
  )
  RETURNING * INTO v_delivery;

  INSERT INTO public.fact_document_events (
    document_id,
    event_type,
    event_label,
    event_payload,
    created_by
  )
  VALUES (
    p_document_id,
    'delivery_queued',
    CASE WHEN p_channel = 'whatsapp' THEN 'WhatsApp en file d''attente' ELSE 'Email en file d''attente' END,
    jsonb_build_object(
      'delivery_id', v_delivery.id,
      'channel', p_channel,
      'recipient', p_recipient,
      'status', 'queued'
    ),
    auth.uid()
  );

  RETURN v_delivery;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fact_queue_delivery(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
