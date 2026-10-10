-- MGL Systems · Actualización arquitectónica crítica · Tarea 3/7
-- Conserva quantity/unit_price como valores cotizados canónicos de Fase 6.

CREATE TYPE public.cost_status AS ENUM ('dentro_presupuesto','alerta_menor','alerta_mayor','critico');

-- Umbrales configurables por proyecto. Defaults iniciales: >0-10% menor, >10-25% mayor, >25% crítico.
ALTER TABLE public.projects
  ADD COLUMN cost_alert_minor_max_pct numeric(8,2) NOT NULL DEFAULT 10,
  ADD COLUMN cost_alert_major_max_pct numeric(8,2) NOT NULL DEFAULT 25,
  ADD CONSTRAINT projects_cost_thresholds_chk CHECK(
    cost_alert_minor_max_pct >= 0 AND cost_alert_major_max_pct >= cost_alert_minor_max_pct
  );

ALTER TABLE public.budget_items
  ADD COLUMN stage_id uuid,
  ADD COLUMN qty_actual numeric(18,4) NOT NULL DEFAULT 0 CHECK(qty_actual>=0),
  ADD COLUMN unit_price_actual numeric(18,4) NOT NULL DEFAULT 0 CHECK(unit_price_actual>=0),
  ADD COLUMN qty_quoted numeric(18,4) GENERATED ALWAYS AS (quantity) STORED,
  ADD COLUMN unit_price_quoted numeric(18,4) GENERATED ALWAYS AS (unit_price) STORED,
  ADD COLUMN actual_amount numeric(18,2) GENERATED ALWAYS AS (round(qty_actual*unit_price_actual,2)) STORED,
  ADD COLUMN deviation_amount numeric(18,2) GENERATED ALWAYS AS (
    round((qty_actual*unit_price_actual)-(quantity*unit_price),2)
  ) STORED,
  ADD COLUMN deviation_pct numeric(18,2) GENERATED ALWAYS AS (
    CASE
      WHEN round(quantity*unit_price,2)=0 THEN NULL
      ELSE round((((qty_actual*unit_price_actual)-(quantity*unit_price))/(quantity*unit_price))*100,2)
    END
  ) STORED,
  ADD COLUMN cost_status public.cost_status NOT NULL DEFAULT 'dentro_presupuesto',
  ADD COLUMN version bigint NOT NULL DEFAULT 1;

UPDATE public.budget_items i
SET stage_id=s.id, updated_at=clock_timestamp(), mutation_id=gen_random_uuid()
FROM public.project_stages s
WHERE s.company_id=i.company_id AND s.project_id=i.project_id AND s.stage_type='field_execution'
  AND i.stage_id IS NULL;

ALTER TABLE public.budget_items
  ALTER COLUMN stage_id SET NOT NULL,
  ADD CONSTRAINT budget_items_stage_fk FOREIGN KEY(company_id,project_id,stage_id)
    REFERENCES public.project_stages(company_id,project_id,id),
  ADD CONSTRAINT budget_items_actual_leaf_chk CHECK(
    item_type='item' OR (qty_actual=0 AND unit_price_actual=0)
  );

CREATE INDEX budget_items_stage_idx
  ON public.budget_items(company_id,project_id,stage_id)
  WHERE deleted_at IS NULL;
CREATE INDEX budget_items_cost_status_idx
  ON public.budget_items(company_id,project_id,cost_status)
  WHERE deleted_at IS NULL AND item_type='item';
