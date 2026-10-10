-- Opcional: ejecutar en Supabase real cuando se implemente el cliente Realtime.
-- No crea ni modifica objetos dentro del esquema reservado realtime.
BEGIN;
DO $$
DECLARE relation_name text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    RAISE EXCEPTION 'No existe supabase_realtime: verificar configuración del proyecto';
  END IF;
  FOREACH relation_name IN ARRAY ARRAY['projects','project_members','tasks','task_dependencies','documents','sst_records'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
       AND schemaname='public' AND tablename=relation_name) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',relation_name);
    END IF;
  END LOOP;
END;
$$;
COMMIT;
