-- MGL Systems · Actualización arquitectónica crítica · Tarea 5/7
-- Se conserva status text de Fase 7 por compatibilidad. workflow_status expone el flujo canónico nuevo.

CREATE TYPE public.material_request_status AS ENUM ('draft','pending','approved','rejected','delivered','cancelled');
CREATE TYPE public.material_request_priority AS ENUM ('low','normal','high','urgent');

ALTER TABLE public.material_requests
  ADD COLUMN workflow_status public.material_request_status NOT NULL DEFAULT 'draft',
  ADD COLUMN approver_id uuid,
  ADD COLUMN priority public.material_request_priority NOT NULL DEFAULT 'normal',
  ADD COLUMN stage_id uuid,
  ADD COLUMN budget_item_id uuid,
  ADD COLUMN version bigint NOT NULL DEFAULT 1;

UPDATE public.material_requests r
SET stage_id=s.id,
    workflow_status=CASE r.status
      WHEN 'submitted' THEN 'pending'::public.material_request_status
      WHEN 'fulfilled' THEN 'delivered'::public.material_request_status
      ELSE r.status::public.material_request_status
    END,
    updated_at=clock_timestamp(), mutation_id=gen_random_uuid()
FROM public.project_stages s
WHERE s.company_id=r.company_id AND s.project_id=r.project_id AND s.stage_type='field_execution'
  AND r.stage_id IS NULL;

ALTER TABLE public.material_requests
  ALTER COLUMN stage_id SET NOT NULL,
  ADD CONSTRAINT material_requests_approver_fk FOREIGN KEY(company_id,approver_id)
    REFERENCES public.profiles(company_id,user_id),
  ADD CONSTRAINT material_requests_stage_fk FOREIGN KEY(company_id,project_id,stage_id)
    REFERENCES public.project_stages(company_id,project_id,id),
  ADD CONSTRAINT material_requests_budget_item_fk FOREIGN KEY(company_id,project_id,budget_item_id)
    REFERENCES public.budget_items(company_id,project_id,id);

CREATE INDEX material_requests_approver_pending_idx
  ON public.material_requests(company_id,approver_id,created_at DESC)
  WHERE deleted_at IS NULL AND approver_id IS NOT NULL AND workflow_status='pending';
CREATE INDEX material_requests_stage_idx
  ON public.material_requests(company_id,project_id,stage_id)
  WHERE deleted_at IS NULL;
CREATE INDEX material_requests_budget_idx
  ON public.material_requests(company_id,project_id,budget_item_id)
  WHERE deleted_at IS NULL AND budget_item_id IS NOT NULL;
