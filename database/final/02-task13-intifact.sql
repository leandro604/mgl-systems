-- MGL Systems · Tarea 13 · estado de Intifact. No almacena API keys en PostgreSQL.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS intifact_idempotency_hash text,
  ADD COLUMN IF NOT EXISTS intifact_document_id text,
  ADD COLUMN IF NOT EXISTS cdr_xml text,
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS provider_status text;
CREATE INDEX IF NOT EXISTS invoices_intifact_document_idx
  ON public.invoices(company_id,intifact_document_id)
  WHERE deleted_at IS NULL AND intifact_document_id IS NOT NULL;
