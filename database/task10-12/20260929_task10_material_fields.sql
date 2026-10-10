-- MGL Systems · Tarea 10 · campos de petición y estimación.
ALTER TABLE public.material_requests
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

UPDATE public.material_requests
SET title=coalesce(nullif(btrim(title),''),'Petición '||number)
WHERE title IS NULL OR btrim(title)='';

ALTER TABLE public.material_requests ALTER COLUMN title SET NOT NULL;
ALTER TABLE public.material_requests DROP CONSTRAINT IF EXISTS material_requests_title_check;
ALTER TABLE public.material_requests ADD CONSTRAINT material_requests_title_check
  CHECK(length(btrim(title)) BETWEEN 2 AND 220);

ALTER TABLE public.material_request_items
  ADD COLUMN IF NOT EXISTS estimated_unit_price numeric(18,4) NOT NULL DEFAULT 0;
ALTER TABLE public.material_request_items DROP CONSTRAINT IF EXISTS material_request_items_estimated_unit_price_check;
ALTER TABLE public.material_request_items ADD CONSTRAINT material_request_items_estimated_unit_price_check
  CHECK(estimated_unit_price>=0);

DO $$ BEGIN
  ALTER TABLE public.material_request_items ADD COLUMN estimated_amount numeric(18,2)
    GENERATED ALWAYS AS (round(quantity*estimated_unit_price,2)) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
