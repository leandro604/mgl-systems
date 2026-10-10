-- MGL Systems · Actualización arquitectónica crítica · Tarea 1/7
-- Extiende perfiles sin alterar el modelo multi-tenant ni el LWW existente.

ALTER TABLE public.profiles
  ADD COLUMN phone text,
  ADD COLUMN phone_secondary text,
  ADD COLUMN dni text,
  ADD COLUMN birth_date date,
  ADD COLUMN hire_date date,
  ADD COLUMN position text,
  ADD COLUMN department text,
  ADD COLUMN emergency_contact_name text,
  ADD COLUMN emergency_contact_phone text,
  ADD COLUMN emergency_contact_relation text,
  ADD COLUMN blood_type text,
  ADD COLUMN photo_drive_id text,
  ADD COLUMN notes text NOT NULL DEFAULT '',
  ADD COLUMN version bigint NOT NULL DEFAULT 1,
  ADD CONSTRAINT profiles_phone_chk CHECK(phone IS NULL OR phone ~ '^\\+?[0-9][0-9 -]{6,20}$'),
  ADD CONSTRAINT profiles_phone_secondary_chk CHECK(phone_secondary IS NULL OR phone_secondary ~ '^\\+?[0-9][0-9 -]{6,20}$'),
  ADD CONSTRAINT profiles_dni_chk CHECK(dni IS NULL OR dni ~ '^[0-9]{8}$'),
  ADD CONSTRAINT profiles_emergency_phone_chk CHECK(emergency_contact_phone IS NULL OR emergency_contact_phone ~ '^\\+?[0-9][0-9 -]{6,20}$'),
  ADD CONSTRAINT profiles_blood_type_chk CHECK(blood_type IS NULL OR blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-'));

CREATE UNIQUE INDEX profiles_company_dni_uidx
  ON public.profiles(company_id,dni)
  WHERE deleted_at IS NULL AND dni IS NOT NULL;
