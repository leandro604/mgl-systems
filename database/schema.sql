-- MGL Systems / Fase 1. PostgreSQL 15+ y Supabase Auth.
-- Ejecutar una sola vez en un proyecto NUEVO. No modifica auth.users ni realtime.
-- Las excepciones abortan la transacción completa: nunca se ocultan errores.
BEGIN;
CREATE SCHEMA IF NOT EXISTS mgl_private;
REVOKE ALL ON SCHEMA mgl_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA mgl_private TO authenticated, service_role;
CREATE TYPE public.app_role AS ENUM ('admin','pm','supervisor','field_worker');
CREATE TYPE public.task_status AS ENUM ('todo','in_progress','blocked','done');
CREATE TYPE public.invoice_status AS ENUM ('draft','queued','processing','submitted','accepted','rejected','unknown','voided');

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  legal_name text NOT NULL CHECK(length(trim(legal_name)) BETWEEN 2 AND 200),
  ruc text NOT NULL UNIQUE CHECK(ruc ~ '^[0-9]{11}$'),
  timezone text NOT NULL DEFAULT 'America/Lima',
  currency text NOT NULL DEFAULT 'PEN' CHECK(currency IN ('PEN','USD'))
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  UNIQUE(company_id,id),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  full_name text NOT NULL CHECK(length(trim(full_name)) BETWEEN 2 AND 150),
  role public.app_role NOT NULL DEFAULT 'field_worker',
  UNIQUE(company_id,user_id)
);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  UNIQUE(company_id,id),
  code text NOT NULL CHECK(length(code) BETWEEN 1 AND 40),
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 200),
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'planning' CHECK(status IN ('planning','active','on_hold','completed')),
  starts_on date,
  ends_on date,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  FOREIGN KEY(company_id,created_by) REFERENCES public.profiles(company_id,user_id),
  UNIQUE(company_id,code),
  CHECK(ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  UNIQUE(company_id,id),
  project_id uuid NOT NULL,
  FOREIGN KEY(company_id,project_id) REFERENCES public.projects(company_id,id),
  user_id uuid NOT NULL,
  FOREIGN KEY(company_id,user_id) REFERENCES public.profiles(company_id,user_id),
  UNIQUE(company_id,project_id,user_id)
);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  UNIQUE(company_id,id),
  project_id uuid NOT NULL,
  FOREIGN KEY(company_id,project_id) REFERENCES public.projects(company_id,id),
  title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 250),
  description text NOT NULL DEFAULT '',
  status public.task_status NOT NULL DEFAULT 'todo',
  priority smallint NOT NULL DEFAULT 2 CHECK(priority BETWEEN 1 AND 4),
  assignee_id uuid,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  starts_on date,
  due_on date,
  progress smallint NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
  position numeric(18,6) NOT NULL DEFAULT 0,
  FOREIGN KEY(company_id,assignee_id) REFERENCES public.profiles(company_id,user_id),
  FOREIGN KEY(company_id,created_by) REFERENCES public.profiles(company_id,user_id),
  UNIQUE(company_id,project_id,id),
  CHECK(due_on IS NULL OR starts_on IS NULL OR due_on >= starts_on),
  CHECK((status = 'done' AND progress = 100) OR (status <> 'done' AND progress < 100))
);

CREATE TABLE public.task_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  UNIQUE(company_id,id),
  project_id uuid NOT NULL,
  FOREIGN KEY(company_id,project_id) REFERENCES public.projects(company_id,id),
  task_id uuid NOT NULL,
  depends_on_task_id uuid NOT NULL,
  FOREIGN KEY(company_id,project_id,task_id) REFERENCES public.tasks(company_id,project_id,id),
  FOREIGN KEY(company_id,project_id,depends_on_task_id) REFERENCES public.tasks(company_id,project_id,id),
  UNIQUE(company_id,project_id,task_id,depends_on_task_id),
  CHECK(task_id <> depends_on_task_id)
);

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  UNIQUE(company_id,id),
  project_id uuid NOT NULL,
  FOREIGN KEY(company_id,project_id) REFERENCES public.projects(company_id,id),
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 255),
  provider text NOT NULL CHECK(provider IN ('google_drive','onedrive')),
  provider_account_id text NOT NULL,
  external_file_id text NOT NULL,
  web_url text NOT NULL CHECK(web_url ~ '^https://'),
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK(size_bytes >= 0),
  sha256 text CHECK(sha256 ~ '^[a-f0-9]{64}$'),
  uploaded_by uuid NOT NULL DEFAULT auth.uid(),
  FOREIGN KEY(company_id,uploaded_by) REFERENCES public.profiles(company_id,user_id),
  UNIQUE(company_id,project_id,provider,provider_account_id,external_file_id)
);

CREATE TABLE public.sst_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  UNIQUE(company_id,id),
  project_id uuid NOT NULL,
  FOREIGN KEY(company_id,project_id) REFERENCES public.projects(company_id,id),
  record_type text NOT NULL CHECK(record_type IN ('inspection','incident','training','permit')),
  title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 250),
  occurred_at timestamptz NOT NULL,
  details jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(details) = 'object'),
  document_id uuid,
  recorded_by uuid NOT NULL DEFAULT auth.uid(),
  FOREIGN KEY(company_id,recorded_by) REFERENCES public.profiles(company_id,user_id)
);

ALTER TABLE public.documents ADD UNIQUE(company_id,project_id,id);

ALTER TABLE public.sst_records ADD FOREIGN KEY(company_id,project_id,document_id) REFERENCES public.documents(company_id,project_id,id);

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  UNIQUE(company_id,id),
  project_id uuid NOT NULL,
  FOREIGN KEY(company_id,project_id) REFERENCES public.projects(company_id,id),
  number text NOT NULL,
  supplier_name text NOT NULL,
  supplier_ruc text CHECK(supplier_ruc ~ '^[0-9]{11}$'),
  currency text NOT NULL DEFAULT 'PEN' CHECK(currency IN ('PEN','USD')),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','issued','received','cancelled')),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  FOREIGN KEY(company_id,created_by) REFERENCES public.profiles(company_id,user_id),
  UNIQUE(company_id,number),
  UNIQUE(company_id,project_id,id)
);

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  UNIQUE(company_id,id),
  project_id uuid NOT NULL,
  FOREIGN KEY(company_id,project_id) REFERENCES public.projects(company_id,id),
  document_type text NOT NULL DEFAULT '01' CHECK(document_type IN ('01','03')),
  series text,
  number bigint CHECK(number > 0),
  issued_on date NOT NULL DEFAULT CURRENT_DATE,
  currency text NOT NULL DEFAULT 'PEN' CHECK(currency IN ('PEN','USD')),
  customer_document_type text NOT NULL CHECK(customer_document_type IN ('1','6','0')),
  customer_document_number text NOT NULL,
  customer_name text NOT NULL,
  customer_address text NOT NULL DEFAULT '',
  status public.invoice_status NOT NULL DEFAULT 'draft',
  pse_request_id text,
  pse_response jsonb,
  cdr_url text CHECK(cdr_url ~ '^https://'),
  cdr_code text,
  accepted_at timestamptz,
  last_error text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  FOREIGN KEY(company_id,created_by) REFERENCES public.profiles(company_id,user_id),
  UNIQUE(company_id,document_type,series,number),
  UNIQUE(company_id,project_id,id),
  CHECK((series IS NULL) = (number IS NULL)),
  CHECK(series IS NULL OR (document_type='01' AND series ~ '^F[A-Z0-9]{3}$') OR (document_type='03' AND series ~ '^B[A-Z0-9]{3}$')),
  CHECK(status <> 'accepted' OR (cdr_code='0' AND cdr_url IS NOT NULL AND accepted_at IS NOT NULL AND number IS NOT NULL)),
  CHECK(document_type <> '01' OR (customer_document_type='6' AND customer_document_number ~ '^[0-9]{11}$'))
);

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  UNIQUE(company_id,id),
  project_id uuid NOT NULL,
  FOREIGN KEY(company_id,project_id) REFERENCES public.projects(company_id,id),
  purchase_order_id uuid NOT NULL,
  line_number integer NOT NULL CHECK(line_number > 0),
  description text NOT NULL CHECK(length(trim(description)) BETWEEN 1 AND 500),
  unit_code text NOT NULL DEFAULT 'NIU',
  quantity numeric(14,4) NOT NULL CHECK(quantity > 0 AND quantity < 10000000000),
  unit_price numeric(16,6) NOT NULL CHECK(unit_price >= 0 AND unit_price < 10000000000),
  tax_rate numeric(5,2) NOT NULL DEFAULT 18 CHECK(tax_rate BETWEEN 0 AND 100),
  tax_affectation_code text NOT NULL DEFAULT '10' CHECK(tax_affectation_code = '10'),
  net_amount numeric GENERATED ALWAYS AS (round(quantity * unit_price,2)) STORED,
  tax_amount numeric GENERATED ALWAYS AS (round(round(quantity * unit_price,2) * tax_rate / 100,2)) STORED,
  FOREIGN KEY(company_id,project_id,purchase_order_id) REFERENCES public.purchase_orders(company_id,project_id,id),
  UNIQUE(company_id,purchase_order_id,line_number)
);

CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  UNIQUE(company_id,id),
  project_id uuid NOT NULL,
  FOREIGN KEY(company_id,project_id) REFERENCES public.projects(company_id,id),
  invoice_id uuid NOT NULL,
  line_number integer NOT NULL CHECK(line_number > 0),
  description text NOT NULL CHECK(length(trim(description)) BETWEEN 1 AND 500),
  unit_code text NOT NULL DEFAULT 'NIU',
  quantity numeric(14,4) NOT NULL CHECK(quantity > 0 AND quantity < 10000000000),
  unit_price numeric(16,6) NOT NULL CHECK(unit_price >= 0 AND unit_price < 10000000000),
  tax_rate numeric(5,2) NOT NULL DEFAULT 18 CHECK(tax_rate BETWEEN 0 AND 100),
  tax_affectation_code text NOT NULL DEFAULT '10' CHECK(tax_affectation_code = '10'),
  net_amount numeric GENERATED ALWAYS AS (round(quantity * unit_price,2)) STORED,
  tax_amount numeric GENERATED ALWAYS AS (round(round(quantity * unit_price,2) * tax_rate / 100,2)) STORED,
  FOREIGN KEY(company_id,project_id,invoice_id) REFERENCES public.invoices(company_id,project_id,id),
  UNIQUE(company_id,invoice_id,line_number)
);

CREATE TABLE public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  UNIQUE(company_id,id),
  project_id uuid NOT NULL,
  FOREIGN KEY(company_id,project_id) REFERENCES public.projects(company_id,id),
  actor_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  operation text NOT NULL CHECK(operation IN ('create','update','soft_delete','restore')),
  payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
  result text NOT NULL CHECK(result IN ('applied','conflict','rejected')),
  response jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(response) = 'object'),
  FOREIGN KEY(company_id,actor_id) REFERENCES public.profiles(company_id,user_id),
  UNIQUE(company_id,actor_id,mutation_id)
);

-- Helpers internos: autorización siempre basada en auth.uid(), nunca user_metadata.
-- SECURITY DEFINER aquí evita recursión de policies. No exponer mgl_private vía API.
CREATE FUNCTION mgl_private.company_role(cid uuid) RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.role FROM public.profiles p JOIN public.companies c ON c.id=p.company_id
  WHERE auth.uid() IS NOT NULL AND p.user_id=auth.uid() AND p.company_id=cid
    AND p.deleted_at IS NULL AND c.deleted_at IS NULL;
$$;
CREATE FUNCTION mgl_private.project_access(cid uuid, pid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND mgl_private.company_role(cid) IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.project_members m WHERE m.company_id=cid AND m.project_id=pid
      AND m.user_id=auth.uid() AND m.deleted_at IS NULL
  );
$$;
CREATE FUNCTION mgl_private.project_write(cid uuid, pid uuid, allowed public.app_role[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND mgl_private.project_access(cid,pid)
    AND mgl_private.company_role(cid)=ANY(allowed)
    AND EXISTS(SELECT 1 FROM public.projects p WHERE p.company_id=cid AND p.id=pid AND p.deleted_at IS NULL);
$$;
-- project_access permite leer tombstones de proyectos eliminados. project_write no
-- permite cambiar hijos de un proyecto eliminado. La interfaz filtra deleted_at.
CREATE FUNCTION mgl_private.row_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: use deleted_at; physical deletion forbidden';
  END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW.id<>OLD.id OR NEW.created_at<>OLD.created_at
       OR (to_jsonb(NEW)->'company_id') IS DISTINCT FROM (to_jsonb(OLD)->'company_id')
       OR (to_jsonb(NEW)->'project_id') IS DISTINCT FROM (to_jsonb(OLD)->'project_id')
       OR (to_jsonb(NEW)->'created_by') IS DISTINCT FROM (to_jsonb(OLD)->'created_by')
       OR (to_jsonb(NEW)->'user_id') IS DISTINCT FROM (to_jsonb(OLD)->'user_id')
       OR (to_jsonb(NEW)->'uploaded_by') IS DISTINCT FROM (to_jsonb(OLD)->'uploaded_by')
       OR (to_jsonb(NEW)->'recorded_by') IS DISTINCT FROM (to_jsonb(OLD)->'recorded_by') THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: immutable identity/tenant/project/author';
    END IF;
    -- LWW: updated_at conserva la fecha de edición del cliente. UUID desempata.
    -- La fase 2 convertirá 40001 en resultado conflict con la fila canónica.
    IF (NEW.updated_at,NEW.mutation_id) <= (OLD.updated_at,OLD.mutation_id) THEN
      RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='MGL_LWW_CONFLICT';
    END IF;
  END IF;
  IF NEW.updated_at > clock_timestamp()+interval '5 minutes' THEN
    RAISE EXCEPTION USING ERRCODE='22007', MESSAGE='MGL: clock too far in future';
  END IF;
  IF TG_OP='INSERT' THEN
    NEW.created_at := clock_timestamp();
  END IF;
  NEW.server_updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;
-- Asignar automáticamente al creador evita un proyecto inaccesible tras INSERT.
CREATE FUNCTION mgl_private.assign_project_creator() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.created_by <> auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: invalid creator';
  END IF;
  INSERT INTO public.project_members(company_id,project_id,user_id)
  VALUES(NEW.company_id,NEW.id,NEW.created_by);
  RETURN NEW;
END;
$$;
CREATE TRIGGER project_creator AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION mgl_private.assign_project_creator();

CREATE FUNCTION mgl_private.validate_task() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- La FK protege la compañía; esta comprobación exige una asignación activa.
  IF NEW.assignee_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id) AND NOT EXISTS (
    SELECT 1 FROM public.project_members m JOIN public.profiles p
      ON p.company_id=m.company_id AND p.user_id=m.user_id
    WHERE m.company_id=NEW.company_id AND m.project_id=NEW.project_id
      AND m.user_id=NEW.assignee_id AND m.deleted_at IS NULL AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: assignee is not an active project member';
  END IF;
  IF mgl_private.company_role(NEW.company_id)='field_worker' THEN
    IF TG_OP='INSERT' AND (NEW.created_by<>auth.uid() OR NEW.assignee_id IS DISTINCT FROM auth.uid()) THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: workers create only self-assigned tasks';
    END IF;
    IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['status','progress','updated_at','server_updated_at','mutation_id'])
       IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','progress','updated_at','server_updated_at','mutation_id']) THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: workers may update only status and progress';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_task BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION mgl_private.validate_task();

CREATE FUNCTION mgl_private.validate_dependency() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Serializa cambios al grafo del proyecto para evitar ciclos concurrentes.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.project_id::text,0));
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM public.tasks t WHERE t.company_id=NEW.company_id AND t.project_id=NEW.project_id
      AND t.id IN (NEW.task_id,NEW.depends_on_task_id) AND t.deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: dependency points to deleted task';
  END IF;
  IF EXISTS (
    WITH RECURSIVE ancestors(id) AS (
      SELECT NEW.depends_on_task_id
      UNION
      SELECT d.depends_on_task_id FROM public.task_dependencies d JOIN ancestors a ON d.task_id=a.id
      WHERE d.company_id=NEW.company_id AND d.project_id=NEW.project_id AND d.deleted_at IS NULL AND d.id<>NEW.id
    ) SELECT 1 FROM ancestors WHERE id=NEW.task_id
  ) THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: cyclic task dependency'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_dependency BEFORE INSERT OR UPDATE ON public.task_dependencies
FOR EACH ROW EXECUTE FUNCTION mgl_private.validate_dependency();

CREATE FUNCTION mgl_private.lock_financial_line() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE parent_status text; parent_deleted timestamptz; parent_id uuid;
BEGIN
  parent_id := (to_jsonb(NEW)->>TG_ARGV[1])::uuid;
  IF TG_OP='UPDATE' AND (to_jsonb(NEW)->TG_ARGV[1]) IS DISTINCT FROM (to_jsonb(OLD)->TG_ARGV[1]) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: immutable line parent';
  END IF;
  -- Identificadores proceden de argumentos estáticos del trigger, no del cliente.
  EXECUTE format('SELECT status::text,deleted_at FROM public.%I WHERE company_id=$1 AND project_id=$2 AND id=$3 FOR UPDATE',TG_ARGV[0])
    INTO parent_status,parent_deleted USING NEW.company_id,NEW.project_id,parent_id;
  IF parent_status IS DISTINCT FROM 'draft' OR parent_deleted IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: financial lines editable only in active drafts';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER lock_invoice_line BEFORE INSERT OR UPDATE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION mgl_private.lock_financial_line('invoices','invoice_id');
CREATE TRIGGER lock_purchase_line BEFORE INSERT OR UPDATE ON public.purchase_order_items
FOR EACH ROW EXECUTE FUNCTION mgl_private.lock_financial_line('purchase_orders','purchase_order_id');

CREATE FUNCTION mgl_private.invoice_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- Una emisión congela identidad fiscal, cliente, fecha y moneda. Solo servidor
  -- puede actualizar estado/CDR. Las líneas quedan congeladas por su trigger.
  IF TG_OP='UPDATE' AND OLD.status<>'draft' AND
    (to_jsonb(NEW)-ARRAY['status','pse_request_id','pse_response','cdr_url','cdr_code','accepted_at','last_error','updated_at','server_updated_at','mutation_id'])
    IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['status','pse_request_id','pse_response','cdr_url','cdr_code','accepted_at','last_error','updated_at','server_updated_at','mutation_id']) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: issued fiscal data is immutable';
  END IF;
  IF TG_OP='UPDATE' AND OLD.status<>'draft' AND NEW.status='draft' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: cannot reopen an emitted invoice';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER invoice_guard BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION mgl_private.invoice_guard();

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.companies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.companies TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.companies TO service_role;
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.companies
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.profiles TO service_role;
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();

CREATE INDEX profiles_company_sync_idx ON public.profiles(company_id,server_updated_at,id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.projects FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.projects TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.projects TO service_role;
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();

CREATE INDEX projects_company_sync_idx ON public.projects(company_id,server_updated_at,id);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_members FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.project_members TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.project_members TO service_role;
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.project_members
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();

CREATE INDEX project_members_company_sync_idx ON public.project_members(company_id,server_updated_at,id);

CREATE INDEX project_members_project_sync_idx ON public.project_members(company_id,project_id,server_updated_at,id);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tasks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tasks TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.tasks TO service_role;
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();

CREATE INDEX tasks_company_sync_idx ON public.tasks(company_id,server_updated_at,id);

CREATE INDEX tasks_project_sync_idx ON public.tasks(company_id,project_id,server_updated_at,id);

ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task_dependencies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.task_dependencies TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.task_dependencies TO service_role;
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.task_dependencies
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();

CREATE INDEX task_dependencies_company_sync_idx ON public.task_dependencies(company_id,server_updated_at,id);

CREATE INDEX task_dependencies_project_sync_idx ON public.task_dependencies(company_id,project_id,server_updated_at,id);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.documents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.documents TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.documents TO service_role;
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.documents
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();

CREATE INDEX documents_company_sync_idx ON public.documents(company_id,server_updated_at,id);

CREATE INDEX documents_project_sync_idx ON public.documents(company_id,project_id,server_updated_at,id);

ALTER TABLE public.sst_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sst_records FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sst_records TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.sst_records TO service_role;
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.sst_records
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();

CREATE INDEX sst_records_company_sync_idx ON public.sst_records(company_id,server_updated_at,id);

CREATE INDEX sst_records_project_sync_idx ON public.sst_records(company_id,project_id,server_updated_at,id);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.purchase_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.purchase_orders TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.purchase_orders TO service_role;
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();

CREATE INDEX purchase_orders_company_sync_idx ON public.purchase_orders(company_id,server_updated_at,id);

CREATE INDEX purchase_orders_project_sync_idx ON public.purchase_orders(company_id,project_id,server_updated_at,id);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoices FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.invoices TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.invoices TO service_role;
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();

CREATE INDEX invoices_company_sync_idx ON public.invoices(company_id,server_updated_at,id);

CREATE INDEX invoices_project_sync_idx ON public.invoices(company_id,project_id,server_updated_at,id);

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.purchase_order_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.purchase_order_items TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.purchase_order_items TO service_role;
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.purchase_order_items
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();

CREATE INDEX purchase_order_items_company_sync_idx ON public.purchase_order_items(company_id,server_updated_at,id);

CREATE INDEX purchase_order_items_project_sync_idx ON public.purchase_order_items(company_id,project_id,server_updated_at,id);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.invoice_items TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.invoice_items TO service_role;
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();

CREATE INDEX invoice_items_company_sync_idx ON public.invoice_items(company_id,server_updated_at,id);

CREATE INDEX invoice_items_project_sync_idx ON public.invoice_items(company_id,project_id,server_updated_at,id);
CREATE INDEX purchase_order_items_company_project_order_idx ON public.purchase_order_items(company_id,project_id,purchase_order_id);
CREATE INDEX invoice_items_company_project_invoice_idx ON public.invoice_items(company_id,project_id,invoice_id);

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sync_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sync_logs TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.sync_logs TO service_role;
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.sync_logs
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();

CREATE INDEX sync_logs_company_sync_idx ON public.sync_logs(company_id,server_updated_at,id);

CREATE INDEX sync_logs_project_sync_idx ON public.sync_logs(company_id,project_id,server_updated_at,id);

CREATE INDEX task_assignee_idx ON public.tasks(company_id,assignee_id);
CREATE INDEX project_members_user_idx ON public.project_members(company_id,user_id,project_id) WHERE deleted_at IS NULL;
CREATE INDEX dependency_reverse_idx ON public.task_dependencies(company_id,project_id,depends_on_task_id);
CREATE INDEX sst_document_idx ON public.sst_records(company_id,project_id,document_id);
CREATE INDEX invoices_creator_idx ON public.invoices(company_id,created_by);
CREATE INDEX projects_creator_idx ON public.projects(company_id,created_by);
CREATE INDEX tasks_creator_idx ON public.tasks(company_id,created_by);
CREATE INDEX documents_uploader_idx ON public.documents(company_id,uploaded_by);
CREATE INDEX sst_recorder_idx ON public.sst_records(company_id,recorded_by);
CREATE INDEX po_creator_idx ON public.purchase_orders(company_id,created_by);

-- Compañías y perfiles: altas y cambios de roles solo por aprovisionamiento servidor.
-- No se obtiene un rol admin desde el registro público de Supabase Auth.
CREATE POLICY company_read ON public.companies FOR SELECT TO authenticated
USING(mgl_private.company_role(id) IS NOT NULL);
GRANT UPDATE(legal_name,updated_at,mutation_id) ON public.companies TO authenticated;
CREATE POLICY company_update ON public.companies FOR UPDATE TO authenticated
USING(mgl_private.company_role(id)='admin') WITH CHECK(mgl_private.company_role(id)='admin');
CREATE POLICY profile_read ON public.profiles FOR SELECT TO authenticated
USING(mgl_private.company_role(company_id) IS NOT NULL);
GRANT UPDATE(full_name,updated_at,mutation_id) ON public.profiles TO authenticated;
CREATE POLICY profile_update ON public.profiles FOR UPDATE TO authenticated
USING(user_id=(select auth.uid()) AND mgl_private.company_role(company_id) IS NOT NULL)
WITH CHECK(user_id=(select auth.uid()) AND mgl_private.company_role(company_id) IS NOT NULL);
-- Todos, incluido admin, requieren membresía explícita para leer un proyecto.
CREATE POLICY projects_read ON public.projects FOR SELECT TO authenticated
USING(mgl_private.project_access(company_id,id));
GRANT INSERT(id,company_id,code,name,description,status,starts_on,ends_on,created_by,updated_at,mutation_id),
 UPDATE(code,name,description,status,starts_on,ends_on,deleted_at,updated_at,mutation_id) ON public.projects TO authenticated;
CREATE POLICY projects_insert ON public.projects FOR INSERT TO authenticated
WITH CHECK(mgl_private.company_role(company_id) IN ('admin','pm') AND created_by=(select auth.uid()));
CREATE POLICY projects_update ON public.projects FOR UPDATE TO authenticated
USING(mgl_private.project_access(company_id,id) AND mgl_private.company_role(company_id) IN ('admin','pm'))
WITH CHECK(mgl_private.project_access(company_id,id) AND mgl_private.company_role(company_id) IN ('admin','pm'));

CREATE POLICY project_members_read ON public.project_members FOR SELECT TO authenticated USING(mgl_private.project_access(company_id,project_id));

CREATE POLICY project_members_insert ON public.project_members FOR INSERT TO authenticated WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]));

CREATE POLICY project_members_update ON public.project_members FOR UPDATE TO authenticated USING(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[])) WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]));

GRANT INSERT,UPDATE ON public.project_members TO authenticated;

CREATE POLICY tasks_read ON public.tasks FOR SELECT TO authenticated USING(mgl_private.project_access(company_id,project_id));

CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated WITH CHECK((mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[]) OR (mgl_private.project_write(company_id,project_id,ARRAY['field_worker']::public.app_role[]) AND assignee_id=(select auth.uid()))) AND created_by=(select auth.uid()));

CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated USING((mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[]) OR (mgl_private.project_write(company_id,project_id,ARRAY['field_worker']::public.app_role[]) AND assignee_id=(select auth.uid()) AND deleted_at IS NULL))) WITH CHECK((mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[]) OR (mgl_private.project_write(company_id,project_id,ARRAY['field_worker']::public.app_role[]) AND assignee_id=(select auth.uid()) AND deleted_at IS NULL)));

GRANT INSERT,UPDATE ON public.tasks TO authenticated;

CREATE POLICY task_dependencies_read ON public.task_dependencies FOR SELECT TO authenticated USING(mgl_private.project_access(company_id,project_id));

CREATE POLICY task_dependencies_insert ON public.task_dependencies FOR INSERT TO authenticated WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[]));

CREATE POLICY task_dependencies_update ON public.task_dependencies FOR UPDATE TO authenticated USING(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[])) WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[]));

GRANT INSERT,UPDATE ON public.task_dependencies TO authenticated;

CREATE POLICY documents_read ON public.documents FOR SELECT TO authenticated USING(mgl_private.project_access(company_id,project_id));

CREATE POLICY documents_insert ON public.documents FOR INSERT TO authenticated WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor','field_worker']::public.app_role[]) AND uploaded_by=(select auth.uid()));

CREATE POLICY documents_update ON public.documents FOR UPDATE TO authenticated USING((mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[]) OR (mgl_private.project_write(company_id,project_id,ARRAY['field_worker']::public.app_role[]) AND uploaded_by=(select auth.uid())))) WITH CHECK((mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[]) OR (mgl_private.project_write(company_id,project_id,ARRAY['field_worker']::public.app_role[]) AND uploaded_by=(select auth.uid()))));

GRANT INSERT,UPDATE ON public.documents TO authenticated;

CREATE POLICY sst_records_read ON public.sst_records FOR SELECT TO authenticated USING(mgl_private.project_access(company_id,project_id));

CREATE POLICY sst_records_insert ON public.sst_records FOR INSERT TO authenticated WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor','field_worker']::public.app_role[]) AND recorded_by=(select auth.uid()));

CREATE POLICY sst_records_update ON public.sst_records FOR UPDATE TO authenticated USING((mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[]) OR (mgl_private.project_write(company_id,project_id,ARRAY['field_worker']::public.app_role[]) AND recorded_by=(select auth.uid())))) WITH CHECK((mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[]) OR (mgl_private.project_write(company_id,project_id,ARRAY['field_worker']::public.app_role[]) AND recorded_by=(select auth.uid()))));

GRANT INSERT,UPDATE ON public.sst_records TO authenticated;

CREATE POLICY purchase_orders_read ON public.purchase_orders FOR SELECT TO authenticated USING(mgl_private.project_access(company_id,project_id) AND mgl_private.company_role(company_id) IN ('admin','pm'));

CREATE POLICY purchase_orders_insert ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]) AND created_by=(select auth.uid()) AND status='draft');

CREATE POLICY purchase_orders_update ON public.purchase_orders FOR UPDATE TO authenticated USING(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[])) WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]));

GRANT INSERT,UPDATE ON public.purchase_orders TO authenticated;

CREATE POLICY invoices_read ON public.invoices FOR SELECT TO authenticated USING(mgl_private.project_access(company_id,project_id) AND mgl_private.company_role(company_id) IN ('admin','pm'));

CREATE POLICY invoices_insert ON public.invoices FOR INSERT TO authenticated WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]) AND created_by=(select auth.uid()) AND status='draft');

CREATE POLICY invoices_update ON public.invoices FOR UPDATE TO authenticated USING(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]) AND status='draft') WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]) AND status='draft');

GRANT INSERT(id,company_id,project_id,document_type,issued_on,currency,customer_document_type,customer_document_number,customer_name,customer_address,created_by,updated_at,mutation_id), UPDATE(document_type,issued_on,currency,customer_document_type,customer_document_number,customer_name,customer_address,deleted_at,updated_at,mutation_id) ON public.invoices TO authenticated;

CREATE POLICY purchase_order_items_read ON public.purchase_order_items FOR SELECT TO authenticated USING(mgl_private.project_access(company_id,project_id) AND mgl_private.company_role(company_id) IN ('admin','pm'));

CREATE POLICY purchase_order_items_insert ON public.purchase_order_items FOR INSERT TO authenticated WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]));

CREATE POLICY purchase_order_items_update ON public.purchase_order_items FOR UPDATE TO authenticated USING(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[])) WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]));

GRANT INSERT,UPDATE ON public.purchase_order_items TO authenticated;

CREATE POLICY invoice_items_read ON public.invoice_items FOR SELECT TO authenticated USING(mgl_private.project_access(company_id,project_id) AND mgl_private.company_role(company_id) IN ('admin','pm'));

CREATE POLICY invoice_items_insert ON public.invoice_items FOR INSERT TO authenticated WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]));

CREATE POLICY invoice_items_update ON public.invoice_items FOR UPDATE TO authenticated USING(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[])) WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]));

GRANT INSERT,UPDATE ON public.invoice_items TO authenticated;

CREATE POLICY sync_logs_read ON public.sync_logs FOR SELECT TO authenticated USING(mgl_private.project_access(company_id,project_id) AND (actor_id=(select auth.uid()) OR mgl_private.company_role(company_id) IN ('admin','pm')));

-- Membresías reactivables, pero solo para perfiles activos de la misma compañía.
CREATE FUNCTION mgl_private.member_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.profiles p
    WHERE p.company_id=NEW.company_id AND p.user_id=NEW.user_id AND p.deleted_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: member profile is inactive';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER member_guard BEFORE INSERT OR UPDATE ON public.project_members
FOR EACH ROW EXECUTE FUNCTION mgl_private.member_guard();
-- Vistas invoker: suman exclusivamente líneas visibles bajo RLS, sin mantener
-- totales duplicados que puedan divergir. No se concede escritura en vistas.
CREATE VIEW public.invoice_totals WITH(security_invoker=true) AS
SELECT h.id,h.company_id,h.project_id,
 coalesce(sum(l.net_amount),0) AS net_amount,
 coalesce(sum(l.tax_amount),0) AS tax_amount,
 coalesce(sum(l.net_amount+l.tax_amount),0) AS total_amount
FROM public.invoices h LEFT JOIN public.invoice_items l
 ON l.company_id=h.company_id AND l.invoice_id=h.id AND l.deleted_at IS NULL
WHERE h.deleted_at IS NULL GROUP BY h.id;
CREATE VIEW public.purchase_order_totals WITH(security_invoker=true) AS
SELECT h.id,h.company_id,h.project_id,
 coalesce(sum(l.net_amount),0) AS net_amount,
 coalesce(sum(l.tax_amount),0) AS tax_amount,
 coalesce(sum(l.net_amount+l.tax_amount),0) AS total_amount
FROM public.purchase_orders h LEFT JOIN public.purchase_order_items l
 ON l.company_id=h.company_id AND l.purchase_order_id=h.id AND l.deleted_at IS NULL
WHERE h.deleted_at IS NULL GROUP BY h.id;
REVOKE ALL ON public.invoice_totals,public.purchase_order_totals FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.invoice_totals,public.purchase_order_totals TO authenticated,service_role;
-- Retirar el EXECUTE implícito a PUBLIC para todos los helpers del esquema nuevo.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mgl_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mgl_private.company_role(uuid),mgl_private.project_access(uuid,uuid),
 mgl_private.project_write(uuid,uuid,public.app_role[]) TO authenticated;
-- Triggers pueden ejecutarse sin exponer sus funciones directamente vía API.
-- RPC invoker: INSERT ... RETURNING podría comprobar SELECT antes del trigger
-- AFTER que asigna al creador. Se inserta sin RETURNING y se lee al finalizar.
CREATE FUNCTION public.create_project(p_id uuid,p_company_id uuid,p_code text,p_name text)
RETURNS public.projects LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result public.projects;
BEGIN
  INSERT INTO public.projects(id,company_id,code,name,created_by)
  VALUES(p_id,p_company_id,p_code,p_name,auth.uid());
  SELECT * INTO STRICT result FROM public.projects WHERE id=p_id;
  RETURN result;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='MGL: project UUID or code already exists';
END;
$$;
REVOKE ALL ON FUNCTION public.create_project(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_project(uuid,uuid,text,text) TO authenticated;
COMMIT;
