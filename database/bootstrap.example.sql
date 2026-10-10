-- MGL Systems: fallback administrativo (SQL Editor).
-- Desde Fase 3, el alta inicial normal usa public.bootstrap_company desde /onboarding.
-- 1. Crear el usuario real en Supabase Auth.
-- 2. Sustituir los NULL por su UUID, razón social, RUC y nombre verdaderos.
-- 3. Ejecutar como propietario de la BD, jamás desde el navegador.
-- No se usa metadata del registro público para elegir compañía ni rol.
BEGIN;
DO $$
DECLARE
  owner_user_id uuid := NULL;
  legal_name_input text := NULL;
  ruc_input text := NULL;
  full_name_input text := NULL;
  company_uuid uuid := gen_random_uuid();
BEGIN
  IF owner_user_id IS NULL OR legal_name_input IS NULL OR ruc_input IS NULL OR full_name_input IS NULL THEN
    RAISE EXCEPTION 'Complete las cuatro variables antes de ejecutar';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=owner_user_id) THEN
    RAISE EXCEPTION 'El usuario no existe en Supabase Auth';
  END IF;
  INSERT INTO public.companies(id,legal_name,ruc) VALUES(company_uuid,legal_name_input,ruc_input);
  INSERT INTO public.profiles(company_id,user_id,full_name,role)
  VALUES(company_uuid,owner_user_id,full_name_input,'admin');
  RAISE NOTICE 'Compañía creada: %',company_uuid;
END;
$$;
COMMIT;
-- Altas posteriores: insertar perfiles con company_id existente y user_id ya
-- creado/invitado por Auth; luego asignar al proyecto mediante project_members.
-- Al editar cualquier registro: updated_at=clock_timestamp(), mutation_id=gen_random_uuid().
