-- MGL Systems · Actualización arquitectónica crítica · Tarea 2/7
-- Etapas operativas del proyecto y asociación obligatoria para tareas/documentos.

CREATE TYPE public.project_stage AS ENUM (
  'management','engineering','procurement','field_execution','finance','quotation_closed','execution_versioned'
);

CREATE TABLE public.project_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  version bigint NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL,
  stage_type public.project_stage NOT NULL,
  code text NOT NULL CHECK(length(trim(code)) BETWEEN 1 AND 20),
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 160),
  sort_order integer NOT NULL DEFAULT 0,
  is_locked boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  UNIQUE(company_id,project_id,id),
  UNIQUE(company_id,project_id,stage_type),
  UNIQUE(company_id,project_id,code),
  FOREIGN KEY(company_id,project_id) REFERENCES public.projects(company_id,id),
  FOREIGN KEY(company_id,created_by) REFERENCES public.profiles(company_id,user_id)
);

CREATE INDEX project_stages_project_sort_idx
  ON public.project_stages(company_id,project_id,sort_order)
  WHERE deleted_at IS NULL;
CREATE INDEX project_stages_creator_idx
  ON public.project_stages(company_id,created_by);

-- Sembrar las 7 etapas en todos los proyectos existentes.
INSERT INTO public.project_stages(company_id,project_id,stage_type,code,name,sort_order,is_locked,created_by)
SELECT p.company_id,p.id,s.stage_type::public.project_stage,s.code,s.name,s.sort_order,s.is_locked,p.created_by
FROM public.projects p
CROSS JOIN (VALUES
  ('management','00','00_Gestion del proyecto',10,false),
  ('engineering','01','01_Ingeniería',20,false),
  ('procurement','02','02_Compras',30,false),
  ('field_execution','04','04_Ejecución en Campo',40,false),
  ('finance','07','07_Finanzas del proyecto',50,false),
  ('quotation_closed','98','98_Cotización (Cerrada)',60,true),
  ('execution_versioned','EV','Ejecución versionada',70,false)
) AS s(stage_type,code,name,sort_order,is_locked)
WHERE p.deleted_at IS NULL;

ALTER TABLE public.tasks ADD COLUMN stage_id uuid;
ALTER TABLE public.documents ADD COLUMN stage_id uuid;

-- Compatibilidad con datos anteriores: tareas -> ejecución; documentos -> gestión.
UPDATE public.tasks t
SET stage_id=s.id, updated_at=clock_timestamp(), mutation_id=gen_random_uuid()
FROM public.project_stages s
WHERE s.company_id=t.company_id AND s.project_id=t.project_id AND s.stage_type='field_execution'
  AND t.stage_id IS NULL;

UPDATE public.documents d
SET stage_id=s.id, updated_at=clock_timestamp(), mutation_id=gen_random_uuid()
FROM public.project_stages s
WHERE s.company_id=d.company_id AND s.project_id=d.project_id AND s.stage_type='management'
  AND d.stage_id IS NULL;

ALTER TABLE public.tasks
  ALTER COLUMN stage_id SET NOT NULL,
  ADD CONSTRAINT tasks_stage_fk FOREIGN KEY(company_id,project_id,stage_id)
    REFERENCES public.project_stages(company_id,project_id,id);
ALTER TABLE public.documents
  ALTER COLUMN stage_id SET NOT NULL,
  ADD CONSTRAINT documents_stage_fk FOREIGN KEY(company_id,project_id,stage_id)
    REFERENCES public.project_stages(company_id,project_id,id);

CREATE INDEX tasks_stage_idx ON public.tasks(company_id,project_id,stage_id) WHERE deleted_at IS NULL;
CREATE INDEX documents_stage_idx ON public.documents(company_id,project_id,stage_id) WHERE deleted_at IS NULL;
