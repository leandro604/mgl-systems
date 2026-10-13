-- MGL Systems · Tarea 13 · Archivo fiscal en Google Drive.
-- Supabase conserva únicamente metadata/referencias; PDF/XML/CDR viven en el Drive de la empresa.

ALTER TABLE public.company_fiscal_settings
  ADD COLUMN IF NOT EXISTS drive_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS drive_provider text NOT NULL DEFAULT 'google',
  ADD COLUMN IF NOT EXISTS drive_cloud_account_id uuid,
  ADD COLUMN IF NOT EXISTS drive_root_folder_id text NOT NULL DEFAULT 'root',
  ADD COLUMN IF NOT EXISTS invoice_pdf_format text NOT NULL DEFAULT 'a4',
  ADD COLUMN IF NOT EXISTS receipt_pdf_format text NOT NULL DEFAULT 'ticket80',
  ADD COLUMN IF NOT EXISTS drive_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS drive_last_sync_error text;

ALTER TABLE public.company_fiscal_settings
  DROP CONSTRAINT IF EXISTS company_fiscal_settings_drive_provider_check,
  ADD CONSTRAINT company_fiscal_settings_drive_provider_check
    CHECK (drive_provider IN ('google')),
  DROP CONSTRAINT IF EXISTS company_fiscal_settings_invoice_pdf_format_check,
  ADD CONSTRAINT company_fiscal_settings_invoice_pdf_format_check
    CHECK (invoice_pdf_format IN ('a4','a5','ticket80','ticket58')),
  DROP CONSTRAINT IF EXISTS company_fiscal_settings_receipt_pdf_format_check,
  ADD CONSTRAINT company_fiscal_settings_receipt_pdf_format_check
    CHECK (receipt_pdf_format IN ('a4','a5','ticket80','ticket58'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.company_fiscal_settings'::regclass
      AND conname='company_fiscal_settings_drive_cloud_account_fk'
  ) THEN
    ALTER TABLE public.company_fiscal_settings
      ADD CONSTRAINT company_fiscal_settings_drive_cloud_account_fk
      FOREIGN KEY (drive_cloud_account_id)
      REFERENCES public.cloud_accounts(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.invoice_cloud_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'google' CHECK(provider='google'),
  cloud_account_id uuid NOT NULL,
  asset_type text NOT NULL CHECK(asset_type IN ('pdf','xml','cdr')),
  pdf_format text NOT NULL DEFAULT '',
  file_id text NOT NULL,
  file_name text NOT NULL,
  web_url text NOT NULL DEFAULT '',
  parent_folder_id text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0 CHECK(size_bytes >= 0),
  checksum_sha256 text,
  synced_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(company_id,id),
  UNIQUE(company_id,invoice_id,asset_type,pdf_format),
  FOREIGN KEY(company_id,project_id) REFERENCES public.projects(company_id,id),
  FOREIGN KEY(company_id,invoice_id) REFERENCES public.invoices(company_id,id),
  FOREIGN KEY(company_id,cloud_account_id) REFERENCES public.cloud_accounts(company_id,id) ON DELETE CASCADE,
  CONSTRAINT invoice_cloud_assets_pdf_format_check CHECK(
    (asset_type='pdf' AND pdf_format IN ('a4','a5','ticket80','ticket58'))
    OR (asset_type<>'pdf' AND pdf_format='')
  )
);

CREATE INDEX IF NOT EXISTS invoice_cloud_assets_invoice_idx
  ON public.invoice_cloud_assets(company_id,invoice_id,asset_type)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS invoice_cloud_assets_cloud_account_idx
  ON public.invoice_cloud_assets(company_id,cloud_account_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.invoice_cloud_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_cloud_assets FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.invoice_cloud_assets TO service_role;

COMMENT ON TABLE public.invoice_cloud_assets IS 'Solo metadata de archivos fiscales almacenados en el Google Drive de cada empresa. No contiene PDF/XML/CDR binarios.';
COMMENT ON COLUMN public.company_fiscal_settings.drive_cloud_account_id IS 'Cuenta Google Drive del administrador usada para el archivo fiscal de la empresa.';
COMMENT ON COLUMN public.company_fiscal_settings.invoice_pdf_format IS 'Formato PDF predeterminado para factura 01.';
COMMENT ON COLUMN public.company_fiscal_settings.receipt_pdf_format IS 'Formato PDF predeterminado para boleta 03.';
