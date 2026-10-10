-- MGL Systems / Fase 6
-- Presupuesto, centros de costo, avance físico, valorizaciones y control de proyecto.
-- Los importes de control se trabajan SIN IGV. Compras/Facturación conservan sus totales tributarios.

CREATE TABLE public.project_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL,
  version_no integer NOT NULL CHECK(version_no > 0),
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 160),
  currency text NOT NULL DEFAULT 'PEN' CHECK(currency IN ('PEN','USD')),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','baseline','superseded','archived')),
  notes text NOT NULL DEFAULT '',
  baseline_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  UNIQUE(company_id,project_id,id),
  UNIQUE(company_id,project_id,version_no),
  FOREIGN KEY(company_id,project_id) REFERENCES public.projects(company_id,id),
  FOREIGN KEY(company_id,created_by) REFERENCES public.profiles(company_id,user_id)
);
CREATE UNIQUE INDEX project_budgets_single_baseline_uidx
  ON public.project_budgets(company_id,project_id)
  WHERE deleted_at IS NULL AND status='baseline';
CREATE INDEX project_budgets_project_idx
  ON public.project_budgets(company_id,project_id,version_no DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE public.budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL,
  budget_id uuid NOT NULL,
  parent_id uuid,
  code text NOT NULL CHECK(length(trim(code)) BETWEEN 1 AND 50),
  description text NOT NULL CHECK(length(trim(description)) BETWEEN 2 AND 300),
  item_type text NOT NULL DEFAULT 'item' CHECK(item_type IN ('group','item')),
  unit_code text NOT NULL DEFAULT 'NIU' CHECK(length(trim(unit_code)) BETWEEN 1 AND 10),
  quantity numeric(18,4) NOT NULL DEFAULT 0,
  unit_price numeric(18,4) NOT NULL DEFAULT 0,
  budget_amount numeric(18,2) GENERATED ALWAYS AS (round(quantity * unit_price,2)) STORED,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE(company_id,project_id,budget_id,id),
  UNIQUE(company_id,project_id,id),
  FOREIGN KEY(company_id,project_id,budget_id) REFERENCES public.project_budgets(company_id,project_id,id),
  FOREIGN KEY(company_id,project_id,budget_id,parent_id) REFERENCES public.budget_items(company_id,project_id,budget_id,id),
  CHECK(
    (item_type='group' AND quantity=0 AND unit_price=0)
    OR
    (item_type='item' AND quantity>0 AND unit_price>=0)
  )
);
CREATE UNIQUE INDEX budget_items_code_uidx
  ON public.budget_items(company_id,budget_id,code)
  WHERE deleted_at IS NULL;
CREATE INDEX budget_items_budget_sort_idx
  ON public.budget_items(company_id,project_id,budget_id,sort_order,code)
  WHERE deleted_at IS NULL;
CREATE INDEX budget_items_parent_idx
  ON public.budget_items(company_id,project_id,budget_id,parent_id)
  WHERE deleted_at IS NULL;

CREATE TABLE public.progress_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL,
  budget_item_id uuid NOT NULL,
  progress_on date NOT NULL DEFAULT CURRENT_DATE,
  quantity numeric(18,4) NOT NULL CHECK(quantity>0),
  notes text NOT NULL DEFAULT '',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  FOREIGN KEY(company_id,project_id,budget_item_id) REFERENCES public.budget_items(company_id,project_id,id),
  FOREIGN KEY(company_id,created_by) REFERENCES public.profiles(company_id,user_id)
);
CREATE INDEX progress_records_item_date_idx
  ON public.progress_records(company_id,project_id,budget_item_id,progress_on)
  WHERE deleted_at IS NULL;

CREATE TABLE public.valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL,
  budget_id uuid NOT NULL,
  number integer NOT NULL CHECK(number>0),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','observed')),
  notes text NOT NULL DEFAULT '',
  submitted_at timestamptz,
  approved_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  UNIQUE(company_id,project_id,id),
  FOREIGN KEY(company_id,project_id,budget_id) REFERENCES public.project_budgets(company_id,project_id,id),
  FOREIGN KEY(company_id,created_by) REFERENCES public.profiles(company_id,user_id),
  CHECK(period_end>=period_start)
);
CREATE UNIQUE INDEX valuations_number_uidx
  ON public.valuations(company_id,project_id,budget_id,number)
  WHERE deleted_at IS NULL;
CREATE INDEX valuations_project_period_idx
  ON public.valuations(company_id,project_id,period_end DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE public.valuation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL,
  valuation_id uuid NOT NULL,
  budget_item_id uuid NOT NULL,
  quantity numeric(18,4) NOT NULL CHECK(quantity>0),
  unit_price numeric(18,4) NOT NULL DEFAULT 0 CHECK(unit_price>=0),
  amount numeric(18,2) GENERATED ALWAYS AS (round(quantity * unit_price,2)) STORED,
  notes text NOT NULL DEFAULT '',
  UNIQUE(company_id,project_id,valuation_id,budget_item_id),
  FOREIGN KEY(company_id,project_id,valuation_id) REFERENCES public.valuations(company_id,project_id,id),
  FOREIGN KEY(company_id,project_id,budget_item_id) REFERENCES public.budget_items(company_id,project_id,id)
);
CREATE INDEX valuation_items_valuation_idx
  ON public.valuation_items(company_id,project_id,valuation_id)
  WHERE deleted_at IS NULL;
CREATE INDEX valuation_items_budget_item_idx
  ON public.valuation_items(company_id,project_id,budget_item_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.purchase_order_items
  ADD COLUMN budget_item_id uuid,
  ADD CONSTRAINT purchase_order_items_budget_item_fk
    FOREIGN KEY(company_id,project_id,budget_item_id)
    REFERENCES public.budget_items(company_id,project_id,id);
CREATE INDEX purchase_order_items_budget_item_idx
  ON public.purchase_order_items(company_id,project_id,budget_item_id)
  WHERE deleted_at IS NULL AND budget_item_id IS NOT NULL;

CREATE FUNCTION mgl_private.budget_header_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.status<>'draft' AND
    (to_jsonb(NEW)-ARRAY['status','baseline_at','updated_at','server_updated_at','mutation_id'])
      IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['status','baseline_at','updated_at','server_updated_at','mutation_id']) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: non-draft budget versions are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER budget_header_guard
BEFORE UPDATE ON public.project_budgets
FOR EACH ROW EXECUTE FUNCTION mgl_private.budget_header_guard();

CREATE FUNCTION mgl_private.budget_item_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_status text; v_parent_type text;
BEGIN
  SELECT b.status INTO v_status
  FROM public.project_budgets b
  WHERE b.company_id=NEW.company_id AND b.project_id=NEW.project_id
    AND b.id=NEW.budget_id AND b.deleted_at IS NULL
  FOR UPDATE;
  IF v_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: budget items are editable only in draft versions';
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT i.item_type INTO v_parent_type
    FROM public.budget_items i
    WHERE i.company_id=NEW.company_id AND i.project_id=NEW.project_id
      AND i.budget_id=NEW.budget_id AND i.id=NEW.parent_id AND i.deleted_at IS NULL;
    IF v_parent_type IS DISTINCT FROM 'group' THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: budget parent must be an active group';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER budget_item_guard
BEFORE INSERT OR UPDATE ON public.budget_items
FOR EACH ROW EXECUTE FUNCTION mgl_private.budget_item_guard();

CREATE FUNCTION mgl_private.progress_record_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_type text; v_status text;
BEGIN
  SELECT i.item_type,b.status INTO v_type,v_status
  FROM public.budget_items i
  JOIN public.project_budgets b
    ON b.company_id=i.company_id AND b.project_id=i.project_id AND b.id=i.budget_id
  WHERE i.company_id=NEW.company_id AND i.project_id=NEW.project_id
    AND i.id=NEW.budget_item_id AND i.deleted_at IS NULL AND b.deleted_at IS NULL;
  IF v_type IS DISTINCT FROM 'item' OR v_status IS DISTINCT FROM 'baseline' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: physical progress requires a leaf item from the active baseline';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER progress_record_guard
BEFORE INSERT OR UPDATE ON public.progress_records
FOR EACH ROW EXECUTE FUNCTION mgl_private.progress_record_guard();

CREATE FUNCTION mgl_private.valuation_header_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_budget_status text;
BEGIN
  IF TG_OP='INSERT' THEN
    SELECT status INTO v_budget_status FROM public.project_budgets
    WHERE company_id=NEW.company_id AND project_id=NEW.project_id AND id=NEW.budget_id AND deleted_at IS NULL;
    IF v_budget_status IS DISTINCT FROM 'baseline' THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: valuations require the active baseline budget';
    END IF;
  ELSIF OLD.status<>'draft' AND
    (to_jsonb(NEW)-ARRAY['status','submitted_at','approved_at','notes','updated_at','server_updated_at','mutation_id'])
      IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['status','submitted_at','approved_at','notes','updated_at','server_updated_at','mutation_id']) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: submitted valuation header is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER valuation_header_guard
BEFORE INSERT OR UPDATE ON public.valuations
FOR EACH ROW EXECUTE FUNCTION mgl_private.valuation_header_guard();

CREATE FUNCTION mgl_private.valuation_item_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_status text; v_budget_id uuid; v_item_budget uuid; v_item_type text; v_price numeric;
BEGIN
  SELECT v.status,v.budget_id INTO v_status,v_budget_id
  FROM public.valuations v
  WHERE v.company_id=NEW.company_id AND v.project_id=NEW.project_id
    AND v.id=NEW.valuation_id AND v.deleted_at IS NULL
  FOR UPDATE;
  IF v_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: valuation lines are editable only in drafts';
  END IF;

  SELECT i.budget_id,i.item_type,i.unit_price INTO v_item_budget,v_item_type,v_price
  FROM public.budget_items i
  WHERE i.company_id=NEW.company_id AND i.project_id=NEW.project_id
    AND i.id=NEW.budget_item_id AND i.deleted_at IS NULL;
  IF v_item_budget IS DISTINCT FROM v_budget_id OR v_item_type IS DISTINCT FROM 'item' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: valuation line must use a leaf item from its budget';
  END IF;
  NEW.unit_price := v_price;
  RETURN NEW;
END;
$$;
CREATE TRIGGER valuation_item_guard
BEFORE INSERT OR UPDATE ON public.valuation_items
FOR EACH ROW EXECUTE FUNCTION mgl_private.valuation_item_guard();

CREATE FUNCTION mgl_private.purchase_budget_link_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_item_type text; v_budget_status text; v_budget_currency text; v_order_currency text;
BEGIN
  IF NEW.budget_item_id IS NULL THEN RETURN NEW; END IF;
  SELECT i.item_type,b.status,b.currency INTO v_item_type,v_budget_status,v_budget_currency
  FROM public.budget_items i
  JOIN public.project_budgets b
    ON b.company_id=i.company_id AND b.project_id=i.project_id AND b.id=i.budget_id
  WHERE i.company_id=NEW.company_id AND i.project_id=NEW.project_id
    AND i.id=NEW.budget_item_id AND i.deleted_at IS NULL AND b.deleted_at IS NULL;
  SELECT h.currency INTO v_order_currency
  FROM public.purchase_orders h
  WHERE h.company_id=NEW.company_id AND h.project_id=NEW.project_id AND h.id=NEW.purchase_order_id;
  IF v_item_type IS DISTINCT FROM 'item' OR v_budget_status IS DISTINCT FROM 'baseline' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: purchase cost code must be a leaf item from the active baseline';
  END IF;
  IF v_budget_currency IS DISTINCT FROM v_order_currency THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: purchase order currency must match budget currency for cost control';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER purchase_budget_link_guard
BEFORE INSERT OR UPDATE ON public.purchase_order_items
FOR EACH ROW EXECUTE FUNCTION mgl_private.purchase_budget_link_guard();

ALTER TABLE public.project_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valuation_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.project_budgets,public.budget_items,public.progress_records,public.valuations,public.valuation_items FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.project_budgets,public.budget_items,public.progress_records,public.valuations,public.valuation_items TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.project_budgets,public.budget_items,public.progress_records,public.valuations,public.valuation_items TO service_role;

CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.project_budgets
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.budget_items
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.progress_records
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.valuations
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.valuation_items
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();

CREATE POLICY project_budgets_read ON public.project_budgets FOR SELECT TO authenticated
USING(mgl_private.project_access(company_id,project_id) AND mgl_private.company_role(company_id) IN ('admin','pm'));
CREATE POLICY project_budgets_insert ON public.project_budgets FOR INSERT TO authenticated
WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]) AND created_by=(select auth.uid()) AND status='draft');
CREATE POLICY project_budgets_update ON public.project_budgets FOR UPDATE TO authenticated
USING(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]))
WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]));
GRANT INSERT(id,company_id,project_id,version_no,name,currency,notes,created_by,updated_at,mutation_id),
 UPDATE(name,currency,notes,deleted_at,updated_at,mutation_id)
 ON public.project_budgets TO authenticated;

CREATE POLICY budget_items_read ON public.budget_items FOR SELECT TO authenticated
USING(mgl_private.project_access(company_id,project_id) AND mgl_private.company_role(company_id) IN ('admin','pm'));
CREATE POLICY budget_items_insert ON public.budget_items FOR INSERT TO authenticated
WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]));
CREATE POLICY budget_items_update ON public.budget_items FOR UPDATE TO authenticated
USING(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]))
WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]));
GRANT INSERT(id,company_id,project_id,budget_id,parent_id,code,description,item_type,unit_code,quantity,unit_price,sort_order,updated_at,mutation_id),
 UPDATE(parent_id,code,description,item_type,unit_code,quantity,unit_price,sort_order,deleted_at,updated_at,mutation_id)
 ON public.budget_items TO authenticated;

CREATE POLICY progress_records_read ON public.progress_records FOR SELECT TO authenticated
USING(mgl_private.project_access(company_id,project_id) AND mgl_private.company_role(company_id) IN ('admin','pm'));
CREATE POLICY progress_records_insert ON public.progress_records FOR INSERT TO authenticated
WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]) AND created_by=(select auth.uid()));
CREATE POLICY progress_records_update ON public.progress_records FOR UPDATE TO authenticated
USING(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]))
WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]));
GRANT INSERT(id,company_id,project_id,budget_item_id,progress_on,quantity,notes,created_by,updated_at,mutation_id),
 UPDATE(progress_on,quantity,notes,deleted_at,updated_at,mutation_id)
 ON public.progress_records TO authenticated;

CREATE POLICY valuations_read ON public.valuations FOR SELECT TO authenticated
USING(mgl_private.project_access(company_id,project_id) AND mgl_private.company_role(company_id) IN ('admin','pm'));
CREATE POLICY valuations_insert ON public.valuations FOR INSERT TO authenticated
WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]) AND created_by=(select auth.uid()) AND status='draft');
CREATE POLICY valuations_update ON public.valuations FOR UPDATE TO authenticated
USING(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]))
WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]));
GRANT INSERT(id,company_id,project_id,budget_id,number,period_start,period_end,notes,created_by,updated_at,mutation_id),
 UPDATE(period_start,period_end,notes,deleted_at,updated_at,mutation_id)
 ON public.valuations TO authenticated;

CREATE POLICY valuation_items_read ON public.valuation_items FOR SELECT TO authenticated
USING(mgl_private.project_access(company_id,project_id) AND mgl_private.company_role(company_id) IN ('admin','pm'));
CREATE POLICY valuation_items_insert ON public.valuation_items FOR INSERT TO authenticated
WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]));
CREATE POLICY valuation_items_update ON public.valuation_items FOR UPDATE TO authenticated
USING(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]))
WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]));
GRANT INSERT(id,company_id,project_id,valuation_id,budget_item_id,quantity,notes,updated_at,mutation_id),
 UPDATE(quantity,notes,deleted_at,updated_at,mutation_id)
 ON public.valuation_items TO authenticated;

CREATE FUNCTION mgl_private.activate_project_budget(p_budget_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_budget public.project_budgets;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='MGL: authentication required';
  END IF;
  SELECT * INTO v_budget FROM public.project_budgets
  WHERE id=p_budget_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT mgl_private.project_write(v_budget.company_id,v_budget.project_id,ARRAY['admin','pm']::public.app_role[]) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: budget access required';
  END IF;
  IF v_budget.status<>'draft' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: only draft budgets can become baseline';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.budget_items i
    WHERE i.company_id=v_budget.company_id AND i.project_id=v_budget.project_id
      AND i.budget_id=v_budget.id AND i.item_type='item' AND i.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: baseline requires at least one budget item';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_budget.project_id::text,61));
  UPDATE public.project_budgets
  SET status='superseded',updated_at=clock_timestamp(),mutation_id=gen_random_uuid()
  WHERE company_id=v_budget.company_id AND project_id=v_budget.project_id
    AND status='baseline' AND deleted_at IS NULL AND id<>v_budget.id;
  UPDATE public.project_budgets
  SET status='baseline',baseline_at=clock_timestamp(),updated_at=clock_timestamp(),mutation_id=gen_random_uuid()
  WHERE id=v_budget.id
  RETURNING * INTO v_budget;

  RETURN jsonb_build_object('id',v_budget.id,'project_id',v_budget.project_id,'status',v_budget.status,'baseline_at',v_budget.baseline_at);
END;
$$;
CREATE FUNCTION public.activate_project_budget(p_budget_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT mgl_private.activate_project_budget(p_budget_id);
$$;
REVOKE ALL ON FUNCTION public.activate_project_budget(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.activate_project_budget(uuid) TO authenticated;
REVOKE ALL ON FUNCTION mgl_private.activate_project_budget(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION mgl_private.activate_project_budget(uuid) TO authenticated;

CREATE FUNCTION mgl_private.transition_valuation(p_valuation_id uuid,p_target_status text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.valuations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='MGL: authentication required';
  END IF;
  IF p_target_status NOT IN ('submitted','approved','observed') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: unsupported valuation status';
  END IF;
  SELECT * INTO v FROM public.valuations WHERE id=p_valuation_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT mgl_private.project_write(v.company_id,v.project_id,ARRAY['admin','pm']::public.app_role[]) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: valuation access required';
  END IF;
  IF NOT (
    (v.status='draft' AND p_target_status='submitted') OR
    (v.status='submitted' AND p_target_status IN ('approved','observed')) OR
    (v.status='observed' AND p_target_status='submitted')
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: invalid valuation transition';
  END IF;
  IF p_target_status='submitted' AND NOT EXISTS(
    SELECT 1 FROM public.valuation_items i
    WHERE i.company_id=v.company_id AND i.project_id=v.project_id
      AND i.valuation_id=v.id AND i.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: valuation requires at least one line';
  END IF;

  UPDATE public.valuations
  SET status=p_target_status,
      submitted_at=CASE WHEN p_target_status='submitted' THEN clock_timestamp() ELSE submitted_at END,
      approved_at=CASE WHEN p_target_status='approved' THEN clock_timestamp() ELSE approved_at END,
      updated_at=clock_timestamp(),mutation_id=gen_random_uuid()
  WHERE id=v.id RETURNING * INTO v;

  RETURN jsonb_build_object('id',v.id,'status',v.status,'submitted_at',v.submitted_at,'approved_at',v.approved_at);
END;
$$;
CREATE FUNCTION public.transition_valuation(p_valuation_id uuid,p_target_status text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT mgl_private.transition_valuation(p_valuation_id,p_target_status);
$$;
REVOKE ALL ON FUNCTION public.transition_valuation(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transition_valuation(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION mgl_private.transition_valuation(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION mgl_private.transition_valuation(uuid,text) TO authenticated;

CREATE VIEW public.valuation_totals WITH(security_invoker=true) AS
SELECT v.id,v.company_id,v.project_id,v.budget_id,
  coalesce(sum(i.amount),0)::numeric(18,2) AS net_amount
FROM public.valuations v
LEFT JOIN public.valuation_items i
  ON i.company_id=v.company_id AND i.project_id=v.project_id
 AND i.valuation_id=v.id AND i.deleted_at IS NULL
WHERE v.deleted_at IS NULL
GROUP BY v.id;

CREATE VIEW public.budget_item_control WITH(security_invoker=true) AS
WITH po AS (
  SELECT l.company_id,l.project_id,l.budget_item_id,
    coalesce(sum(CASE WHEN h.status IN ('issued','received') THEN l.net_amount ELSE 0 END),0) AS committed_net,
    coalesce(sum(CASE WHEN h.status='received' THEN l.net_amount ELSE 0 END),0) AS received_net
  FROM public.purchase_order_items l
  JOIN public.purchase_orders h
    ON h.company_id=l.company_id AND h.project_id=l.project_id AND h.id=l.purchase_order_id
  WHERE l.deleted_at IS NULL AND h.deleted_at IS NULL AND l.budget_item_id IS NOT NULL
  GROUP BY l.company_id,l.project_id,l.budget_item_id
), prog AS (
  SELECT company_id,project_id,budget_item_id,coalesce(sum(quantity),0) AS executed_quantity
  FROM public.progress_records WHERE deleted_at IS NULL
  GROUP BY company_id,project_id,budget_item_id
), val AS (
  SELECT i.company_id,i.project_id,i.budget_item_id,
    coalesce(sum(CASE WHEN v.status='approved' THEN i.amount ELSE 0 END),0) AS approved_valuation_net
  FROM public.valuation_items i
  JOIN public.valuations v
    ON v.company_id=i.company_id AND v.project_id=i.project_id AND v.id=i.valuation_id
  WHERE i.deleted_at IS NULL AND v.deleted_at IS NULL
  GROUP BY i.company_id,i.project_id,i.budget_item_id
)
SELECT i.id AS budget_item_id,i.company_id,i.project_id,i.budget_id,b.version_no,b.status AS budget_status,b.currency,
  i.parent_id,i.code,i.description,i.item_type,i.unit_code,i.quantity,i.unit_price,i.budget_amount,i.sort_order,
  coalesce(po.committed_net,0)::numeric(18,2) AS committed_net,
  coalesce(po.received_net,0)::numeric(18,2) AS received_net,
  coalesce(prog.executed_quantity,0)::numeric(18,4) AS executed_quantity,
  CASE WHEN i.item_type='item' AND i.quantity>0 THEN round((coalesce(prog.executed_quantity,0)/i.quantity)*100,2) ELSE 0 END AS physical_progress_pct,
  coalesce(val.approved_valuation_net,0)::numeric(18,2) AS approved_valuation_net,
  (i.budget_amount-coalesce(po.committed_net,0))::numeric(18,2) AS budget_balance_net
FROM public.budget_items i
JOIN public.project_budgets b
  ON b.company_id=i.company_id AND b.project_id=i.project_id AND b.id=i.budget_id
LEFT JOIN po ON po.company_id=i.company_id AND po.project_id=i.project_id AND po.budget_item_id=i.id
LEFT JOIN prog ON prog.company_id=i.company_id AND prog.project_id=i.project_id AND prog.budget_item_id=i.id
LEFT JOIN val ON val.company_id=i.company_id AND val.project_id=i.project_id AND val.budget_item_id=i.id
WHERE i.deleted_at IS NULL AND b.deleted_at IS NULL;

CREATE VIEW public.project_control_summary WITH(security_invoker=true) AS
WITH leaf AS (
  SELECT * FROM public.budget_item_control WHERE budget_status='baseline' AND item_type='item'
), agg AS (
  SELECT company_id,project_id,budget_id,currency,
    coalesce(sum(budget_amount),0) AS budget_total_net,
    coalesce(sum(committed_net),0) AS committed_cost_net,
    coalesce(sum(received_net),0) AS received_cost_net,
    coalesce(sum(approved_valuation_net),0) AS approved_valuation_net,
    CASE WHEN coalesce(sum(budget_amount),0)>0 THEN
      round((sum(least(greatest(physical_progress_pct,0),100)*budget_amount)/100)/sum(budget_amount)*100,2)
    ELSE 0 END AS physical_progress_pct
  FROM leaf GROUP BY company_id,project_id,budget_id,currency
), unassigned AS (
  SELECT h.company_id,h.project_id,
    coalesce(sum(CASE WHEN h.status IN ('issued','received') THEN l.net_amount ELSE 0 END),0) AS unassigned_committed_net
  FROM public.purchase_orders h
  JOIN public.purchase_order_items l
    ON l.company_id=h.company_id AND l.project_id=h.project_id AND l.purchase_order_id=h.id
  WHERE h.deleted_at IS NULL AND l.deleted_at IS NULL AND l.budget_item_id IS NULL
  GROUP BY h.company_id,h.project_id
)
SELECT p.id AS project_id,p.company_id,a.budget_id,a.currency,
  coalesce(a.budget_total_net,0)::numeric(18,2) AS budget_total_net,
  coalesce(a.committed_cost_net,0)::numeric(18,2) AS committed_cost_net,
  coalesce(a.received_cost_net,0)::numeric(18,2) AS received_cost_net,
  coalesce(a.approved_valuation_net,0)::numeric(18,2) AS approved_valuation_net,
  coalesce(a.physical_progress_pct,0)::numeric(8,2) AS physical_progress_pct,
  CASE WHEN coalesce(a.budget_total_net,0)>0 THEN round((a.committed_cost_net/a.budget_total_net)*100,2) ELSE 0 END AS cost_utilization_pct,
  (coalesce(a.budget_total_net,0)-coalesce(a.committed_cost_net,0))::numeric(18,2) AS budget_balance_net,
  coalesce(u.unassigned_committed_net,0)::numeric(18,2) AS unassigned_committed_net
FROM public.projects p
LEFT JOIN agg a ON a.company_id=p.company_id AND a.project_id=p.id
LEFT JOIN unassigned u ON u.company_id=p.company_id AND u.project_id=p.id
WHERE p.deleted_at IS NULL
  AND mgl_private.company_role(p.company_id) IN ('admin','pm');

REVOKE ALL ON public.valuation_totals,public.budget_item_control,public.project_control_summary FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.valuation_totals,public.budget_item_control,public.project_control_summary TO authenticated,service_role;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mgl_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mgl_private.company_role(uuid),mgl_private.project_access(uuid,uuid),
  mgl_private.project_write(uuid,uuid,public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION mgl_private.activate_project_budget(uuid),mgl_private.transition_valuation(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION mgl_private.bootstrap_company(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION mgl_private.write_sync_receipt(uuid,uuid,uuid,text,uuid,text,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION mgl_private.transition_purchase_order(uuid,text),mgl_private.queue_invoice(uuid,text) TO authenticated;
