-- MGL Systems v0.16.5 · Personalización fiscal / PDF.
-- Datos no secretos de presentación del emisor. La tabla permanece accesible
-- únicamente desde el servidor mediante service_role / secret key.

ALTER TABLE public.company_fiscal_settings
  ADD COLUMN IF NOT EXISTS contact_phones jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS contact_emails jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS logo_path text,
  ADD COLUMN IF NOT EXISTS logo_name text,
  ADD COLUMN IF NOT EXISTS logo_mime text,
  ADD COLUMN IF NOT EXISTS logo_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_thank_you_message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pdf_additional_message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_accounts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS digital_wallets jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.company_fiscal_settings'::regclass
      AND conname = 'company_fiscal_settings_contact_phones_array_check'
  ) THEN
    ALTER TABLE public.company_fiscal_settings
      ADD CONSTRAINT company_fiscal_settings_contact_phones_array_check
      CHECK (jsonb_typeof(contact_phones) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.company_fiscal_settings'::regclass
      AND conname = 'company_fiscal_settings_contact_emails_array_check'
  ) THEN
    ALTER TABLE public.company_fiscal_settings
      ADD CONSTRAINT company_fiscal_settings_contact_emails_array_check
      CHECK (jsonb_typeof(contact_emails) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.company_fiscal_settings'::regclass
      AND conname = 'company_fiscal_settings_bank_accounts_array_check'
  ) THEN
    ALTER TABLE public.company_fiscal_settings
      ADD CONSTRAINT company_fiscal_settings_bank_accounts_array_check
      CHECK (jsonb_typeof(bank_accounts) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.company_fiscal_settings'::regclass
      AND conname = 'company_fiscal_settings_digital_wallets_array_check'
  ) THEN
    ALTER TABLE public.company_fiscal_settings
      ADD CONSTRAINT company_fiscal_settings_digital_wallets_array_check
      CHECK (jsonb_typeof(digital_wallets) = 'array');
  END IF;
END $$;

COMMENT ON COLUMN public.company_fiscal_settings.logo_path IS 'Ruta privada del logo del emisor en Supabase Storage (bucket company-branding).';
COMMENT ON COLUMN public.company_fiscal_settings.bank_accounts IS 'Cuentas bancarias opcionales que pueden mostrarse en la representación PDF.';
COMMENT ON COLUMN public.company_fiscal_settings.digital_wallets IS 'Billeteras digitales opcionales que pueden mostrarse en la representación PDF.';
