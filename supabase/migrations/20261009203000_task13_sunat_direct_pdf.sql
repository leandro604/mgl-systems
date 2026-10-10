-- MGL Systems · Tarea 13 reforzada v2 · SUNAT directo + PDF MGL.
-- Configuración fiscal por empresa. Los secretos se almacenan cifrados por la app
-- y esta tabla no se expone a clientes autenticados; sólo service_role la administra.

CREATE TABLE IF NOT EXISTS public.company_fiscal_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'intifact' CHECK(provider IN ('intifact','sunat_direct')),
  environment text NOT NULL DEFAULT 'beta' CHECK(environment IN ('beta','production')),
  trade_name text NOT NULL DEFAULT '',
  issuer_address text NOT NULL DEFAULT '',
  ubigeo text NOT NULL DEFAULT '',
  department text NOT NULL DEFAULT '',
  province text NOT NULL DEFAULT '',
  district text NOT NULL DEFAULT '',
  establishment_code text NOT NULL DEFAULT '0000' CHECK(establishment_code ~ '^[0-9A-Z]{4}$'),
  sol_user_enc text,
  sol_password_enc text,
  certificate_pfx_enc text,
  certificate_password_enc text,
  certificate_name text,
  certificate_uploaded_at timestamptz,
  configured_by uuid,
  FOREIGN KEY(company_id,configured_by) REFERENCES public.profiles(company_id,user_id)
);

ALTER TABLE public.company_fiscal_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_fiscal_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.company_fiscal_settings TO service_role;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS emission_provider text CHECK(emission_provider IN ('intifact','sunat_direct')),
  ADD COLUMN IF NOT EXISTS sunat_xml text,
  ADD COLUMN IF NOT EXISTS sunat_cdr_zip_base64 text,
  ADD COLUMN IF NOT EXISTS sunat_digest text,
  ADD COLUMN IF NOT EXISTS sunat_response_description text;

CREATE INDEX IF NOT EXISTS invoices_emission_provider_idx
  ON public.invoices(company_id,emission_provider,status)
  WHERE deleted_at IS NULL;

-- La versión original exigía cdr_url para status accepted. SUNAT directo conserva
-- el CDR exacto en base64 + XML, por lo que la evidencia puede ser URL o CDR local.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid='public.invoices'::regclass
      AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%status%accepted%'
      AND pg_get_constraintdef(oid) ILIKE '%cdr_url%'
  LOOP
    EXECUTE format('ALTER TABLE public.invoices DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_accepted_evidence_check;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_accepted_evidence_check CHECK(
    status <> 'accepted'
    OR (
      cdr_code='0'
      AND accepted_at IS NOT NULL
      AND number IS NOT NULL
      AND (cdr_url IS NOT NULL OR cdr_xml IS NOT NULL OR sunat_cdr_zip_base64 IS NOT NULL OR (emission_provider='intifact' AND intifact_document_id IS NOT NULL))
    )
  );

COMMENT ON TABLE public.company_fiscal_settings IS 'Configuración de emisión tributaria por empresa. Los secretos están cifrados y sólo son accesibles server-side.';
COMMENT ON COLUMN public.invoices.sunat_xml IS 'XML UBL 2.1 firmado enviado por el canal SUNAT directo.';
COMMENT ON COLUMN public.invoices.sunat_cdr_zip_base64 IS 'ZIP CDR exacto devuelto por SUNAT, codificado base64.';
