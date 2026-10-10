-- MGL Systems · Tarea 15 · compromisos presupuestales.
ALTER TABLE public.budget_items
  ADD COLUMN IF NOT EXISTS committed_amount numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS executed_amount numeric(18,2) NOT NULL DEFAULT 0;
DO $$ BEGIN
  ALTER TABLE public.budget_items ADD COLUMN available_amount numeric(18,2)
    GENERATED ALWAYS AS (round((quantity*unit_price)-committed_amount-executed_amount,2)) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.budget_items ADD COLUMN over_budget boolean
    GENERATED ALWAYS AS (committed_amount+executed_amount>round(quantity*unit_price,2)) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.budget_commitment_type AS ENUM ('material_request','purchase_order','manual_adjustment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.budget_commitment_status AS ENUM ('committed','executed','cancelled','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.budget_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), mutation_id uuid NOT NULL DEFAULT gen_random_uuid(), version bigint NOT NULL DEFAULT 1,
  deleted_at timestamptz, company_id uuid NOT NULL REFERENCES public.companies(id), project_id uuid NOT NULL, budget_item_id uuid NOT NULL,
  commitment_type public.budget_commitment_type NOT NULL, source_entity text NOT NULL CHECK(length(btrim(source_entity)) BETWEEN 2 AND 80), source_id uuid NOT NULL,
  amount numeric(18,2) NOT NULL CHECK(amount>=0), currency text NOT NULL DEFAULT 'PEN' CHECK(currency IN ('PEN','USD')),
  status public.budget_commitment_status NOT NULL DEFAULT 'committed', committed_at timestamptz NOT NULL DEFAULT clock_timestamp(), executed_at timestamptz,
  cancelled_at timestamptz, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, device_id text NOT NULL DEFAULT '', created_by uuid NOT NULL DEFAULT auth.uid(),
  UNIQUE(company_id,project_id,id), FOREIGN KEY(company_id,project_id) REFERENCES public.projects(company_id,id),
  FOREIGN KEY(company_id,project_id,budget_item_id) REFERENCES public.budget_items(company_id,project_id,id),
  FOREIGN KEY(company_id,created_by) REFERENCES public.profiles(company_id,user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS budget_commitments_source_item_uidx ON public.budget_commitments(company_id,project_id,commitment_type,source_entity,source_id,budget_item_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS budget_commitments_budget_idx ON public.budget_commitments(company_id,project_id,budget_item_id,status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS budget_commitments_source_idx ON public.budget_commitments(company_id,project_id,source_entity,source_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS budget_commitments_creator_idx ON public.budget_commitments(company_id,created_by);

CREATE TABLE IF NOT EXISTS public.activity_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL, actor_id uuid, event_type text NOT NULL, entity_type text NOT NULL, entity_id uuid, message text NOT NULL DEFAULT '', metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  FOREIGN KEY(company_id,project_id) REFERENCES public.projects(company_id,id), FOREIGN KEY(company_id,actor_id) REFERENCES public.profiles(company_id,user_id)
);
CREATE INDEX IF NOT EXISTS activity_feed_project_created_idx ON public.activity_feed(company_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS activity_feed_actor_idx ON public.activity_feed(company_id,actor_id);

CREATE OR REPLACE FUNCTION mgl_private.recalculate_budget_commitment_totals(p_company_id uuid,p_project_id uuid,p_budget_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_committed numeric(18,2); v_executed numeric(18,2);
BEGIN
  SELECT coalesce(sum(amount) FILTER(WHERE status='committed' AND deleted_at IS NULL),0),
         coalesce(sum(amount) FILTER(WHERE status IN ('executed','closed') AND deleted_at IS NULL),0)
  INTO v_committed,v_executed FROM public.budget_commitments
  WHERE company_id=p_company_id AND project_id=p_project_id AND budget_item_id=p_budget_item_id;
  UPDATE public.budget_items SET committed_amount=v_committed,executed_amount=v_executed,updated_at=clock_timestamp(),mutation_id=gen_random_uuid()
  WHERE company_id=p_company_id AND project_id=p_project_id AND id=p_budget_item_id;
END $$;
REVOKE ALL ON FUNCTION mgl_private.recalculate_budget_commitment_totals(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mgl_private.recalculate_budget_commitment_totals(uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION mgl_private.budget_commitment_rollup_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF tg_op='DELETE' THEN PERFORM mgl_private.recalculate_budget_commitment_totals(old.company_id,old.project_id,old.budget_item_id); RETURN old; END IF;
  PERFORM mgl_private.recalculate_budget_commitment_totals(new.company_id,new.project_id,new.budget_item_id);
  IF tg_op='UPDATE' AND old.budget_item_id IS DISTINCT FROM new.budget_item_id THEN PERFORM mgl_private.recalculate_budget_commitment_totals(old.company_id,old.project_id,old.budget_item_id); END IF;
  RETURN new;
END $$;
REVOKE ALL ON FUNCTION mgl_private.budget_commitment_rollup_trigger() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS z_budget_commitment_rollup ON public.budget_commitments;
CREATE TRIGGER z_budget_commitment_rollup AFTER INSERT OR UPDATE OR DELETE ON public.budget_commitments FOR EACH ROW EXECUTE FUNCTION mgl_private.budget_commitment_rollup_trigger();

CREATE OR REPLACE FUNCTION mgl_private.budget_item_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_status text; v_parent_type text; v_role public.app_role;
BEGIN
  SELECT b.status INTO v_status FROM public.project_budgets b WHERE b.company_id=new.company_id AND b.project_id=new.project_id AND b.id=new.budget_id AND b.deleted_at IS NULL FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: budget version not found'; END IF;
  IF new.parent_id IS NOT NULL THEN
    SELECT i.item_type INTO v_parent_type FROM public.budget_items i WHERE i.company_id=new.company_id AND i.project_id=new.project_id AND i.budget_id=new.budget_id AND i.id=new.parent_id AND i.deleted_at IS NULL;
    IF v_parent_type IS DISTINCT FROM 'group' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: budget parent must be an active group'; END IF;
  END IF;
  v_role:=mgl_private.company_role(new.company_id);
  IF v_status='draft' THEN IF v_role NOT IN ('admin','pm') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: only admin or pm can edit draft budgets'; END IF; RETURN new; END IF;
  IF v_status<>'baseline' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: superseded/archived budget items are immutable'; END IF;
  IF tg_op='INSERT' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: baseline structure is immutable'; END IF;
  IF (to_jsonb(new)-array['qty_actual','unit_price_actual','cost_status','budget_amount','qty_quoted','unit_price_quoted','actual_amount','deviation_amount','deviation_pct','committed_amount','executed_amount','available_amount','over_budget','updated_at','server_updated_at','mutation_id','version'])
     IS DISTINCT FROM
     (to_jsonb(old)-array['qty_actual','unit_price_actual','cost_status','budget_amount','qty_quoted','unit_price_quoted','actual_amount','deviation_amount','deviation_pct','committed_amount','executed_amount','available_amount','over_budget','updated_at','server_updated_at','mutation_id','version'])
  THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: quoted baseline fields are immutable'; END IF;
  IF v_role='field_worker' THEN
    IF new.unit_price_actual IS DISTINCT FROM old.unit_price_actual OR NOT EXISTS(SELECT 1 FROM public.tasks t WHERE t.company_id=new.company_id AND t.project_id=new.project_id AND t.budget_item_id=new.id AND t.assignee_id=auth.uid() AND t.deleted_at IS NULL)
    THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: worker may update only actual quantity of an assigned budget item'; END IF;
  ELSIF v_role NOT IN ('admin','pm','supervisor') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: insufficient cost-control role'; END IF;
  RETURN new;
END $$;

CREATE OR REPLACE FUNCTION mgl_private.material_request_commitment_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_currency text:='PEN'; v_line record; v_actor uuid:=coalesce(auth.uid(),new.requested_by);
BEGIN
  IF tg_op<>'UPDATE' OR new.status IS NOT DISTINCT FROM old.status THEN RETURN new; END IF;
  SELECT coalesce(pb.currency,'PEN') INTO v_currency FROM public.project_budgets pb WHERE pb.company_id=new.company_id AND pb.project_id=new.project_id AND pb.status='baseline' AND pb.deleted_at IS NULL ORDER BY pb.version_no DESC LIMIT 1;
  IF new.status='approved' THEN
    FOR v_line IN SELECT coalesce(i.budget_item_id,new.budget_item_id) budget_item_id,round(sum(i.quantity*i.estimated_unit_price),2) amount
      FROM public.material_request_items i WHERE i.company_id=new.company_id AND i.project_id=new.project_id AND i.request_id=new.id AND i.deleted_at IS NULL AND coalesce(i.budget_item_id,new.budget_item_id) IS NOT NULL GROUP BY coalesce(i.budget_item_id,new.budget_item_id)
    LOOP
      INSERT INTO public.budget_commitments(company_id,project_id,budget_item_id,commitment_type,source_entity,source_id,amount,currency,status,committed_at,created_by,metadata)
      VALUES(new.company_id,new.project_id,v_line.budget_item_id,'material_request','material_requests',new.id,coalesce(v_line.amount,0),v_currency,'committed',clock_timestamp(),v_actor,jsonb_build_object('request_number',new.number,'title',new.title))
      ON CONFLICT(company_id,project_id,commitment_type,source_entity,source_id,budget_item_id) WHERE deleted_at IS NULL
      DO UPDATE SET amount=excluded.amount,status='committed',cancelled_at=NULL,executed_at=NULL,updated_at=clock_timestamp(),mutation_id=gen_random_uuid(),version=public.budget_commitments.version+1;
    END LOOP;
    INSERT INTO public.activity_feed(company_id,project_id,actor_id,event_type,entity_type,entity_id,message,metadata) VALUES(new.company_id,new.project_id,v_actor,'commitment_created','material_request',new.id,'Compromiso creado por petición aprobada',jsonb_build_object('number',new.number));
  ELSIF new.status='fulfilled' THEN
    UPDATE public.budget_commitments SET status='executed',executed_at=clock_timestamp(),cancelled_at=NULL,updated_at=clock_timestamp(),mutation_id=gen_random_uuid(),version=version+1
    WHERE company_id=new.company_id AND project_id=new.project_id AND source_entity='material_requests' AND source_id=new.id AND status='committed' AND deleted_at IS NULL;
    INSERT INTO public.activity_feed(company_id,project_id,actor_id,event_type,entity_type,entity_id,message,metadata) VALUES(new.company_id,new.project_id,v_actor,'commitment_executed','material_request',new.id,'Compromiso ejecutado por entrega de materiales',jsonb_build_object('number',new.number));
  ELSIF new.status='cancelled' THEN
    UPDATE public.budget_commitments SET status='cancelled',cancelled_at=clock_timestamp(),updated_at=clock_timestamp(),mutation_id=gen_random_uuid(),version=version+1
    WHERE company_id=new.company_id AND project_id=new.project_id AND source_entity='material_requests' AND source_id=new.id AND status IN ('committed','executed') AND deleted_at IS NULL;
    INSERT INTO public.activity_feed(company_id,project_id,actor_id,event_type,entity_type,entity_id,message,metadata) VALUES(new.company_id,new.project_id,v_actor,'commitment_cancelled','material_request',new.id,'Compromiso revertido por cancelación',jsonb_build_object('number',new.number));
  END IF;
  RETURN new;
END $$;
REVOKE ALL ON FUNCTION mgl_private.material_request_commitment_trigger() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS material_request_commitments ON public.material_requests;
CREATE TRIGGER material_request_commitments AFTER UPDATE OF status ON public.material_requests FOR EACH ROW EXECUTE FUNCTION mgl_private.material_request_commitment_trigger();

ALTER TABLE public.budget_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_commitments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.budget_commitments,public.activity_feed FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.budget_commitments,public.activity_feed TO authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.budget_commitments,public.activity_feed TO service_role;
DROP POLICY IF EXISTS budget_commitments_read ON public.budget_commitments;
CREATE POLICY budget_commitments_read ON public.budget_commitments FOR SELECT TO authenticated USING(mgl_private.project_access(company_id,project_id));
DROP POLICY IF EXISTS activity_feed_read ON public.activity_feed;
CREATE POLICY activity_feed_read ON public.activity_feed FOR SELECT TO authenticated USING(mgl_private.project_access(company_id,project_id));
