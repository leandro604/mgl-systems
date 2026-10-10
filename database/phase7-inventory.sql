-- MGL Systems / Fase 7
-- Almacenes, catálogo de materiales, requerimientos y movimientos de stock.
-- Las existencias se calculan desde transacciones POSTED inmutables; no se mantiene un saldo editable.

CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  sku text NOT NULL CHECK(length(trim(sku)) BETWEEN 1 AND 60),
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 220),
  category text NOT NULL DEFAULT '',
  unit_code text NOT NULL DEFAULT 'NIU' CHECK(length(trim(unit_code)) BETWEEN 1 AND 10),
  min_stock numeric(18,4) NOT NULL DEFAULT 0 CHECK(min_stock>=0),
  notes text NOT NULL DEFAULT '',
  UNIQUE(company_id,id)
);
CREATE UNIQUE INDEX materials_company_sku_uidx ON public.materials(company_id,sku) WHERE deleted_at IS NULL;
CREATE INDEX materials_company_name_idx ON public.materials(company_id,name) WHERE deleted_at IS NULL;

CREATE TABLE public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL,
  code text NOT NULL CHECK(length(trim(code)) BETWEEN 1 AND 40),
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 160),
  location text NOT NULL DEFAULT '',
  responsible_id uuid,
  UNIQUE(company_id,project_id,id),
  FOREIGN KEY(company_id,project_id) REFERENCES public.projects(company_id,id),
  FOREIGN KEY(company_id,responsible_id) REFERENCES public.profiles(company_id,user_id)
);
CREATE UNIQUE INDEX warehouses_project_code_uidx ON public.warehouses(company_id,project_id,code) WHERE deleted_at IS NULL;
CREATE INDEX warehouses_responsible_idx ON public.warehouses(company_id,responsible_id) WHERE deleted_at IS NULL AND responsible_id IS NOT NULL;

CREATE TABLE public.material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL,
  number text NOT NULL CHECK(length(trim(number)) BETWEEN 1 AND 60),
  needed_on date,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected','fulfilled','cancelled')),
  notes text NOT NULL DEFAULT '',
  requested_by uuid NOT NULL DEFAULT auth.uid(),
  approved_by uuid,
  approved_at timestamptz,
  UNIQUE(company_id,project_id,id),
  FOREIGN KEY(company_id,project_id) REFERENCES public.projects(company_id,id),
  FOREIGN KEY(company_id,requested_by) REFERENCES public.profiles(company_id,user_id),
  FOREIGN KEY(company_id,approved_by) REFERENCES public.profiles(company_id,user_id)
);
CREATE UNIQUE INDEX material_requests_project_number_uidx ON public.material_requests(company_id,project_id,number) WHERE deleted_at IS NULL;
CREATE INDEX material_requests_status_idx ON public.material_requests(company_id,project_id,status,needed_on) WHERE deleted_at IS NULL;
CREATE INDEX material_requests_requester_idx ON public.material_requests(company_id,requested_by) WHERE deleted_at IS NULL;
CREATE INDEX material_requests_approver_idx ON public.material_requests(company_id,approved_by) WHERE deleted_at IS NULL AND approved_by IS NOT NULL;

CREATE TABLE public.material_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL,
  request_id uuid NOT NULL,
  material_id uuid NOT NULL,
  budget_item_id uuid,
  quantity numeric(18,4) NOT NULL CHECK(quantity>0),
  notes text NOT NULL DEFAULT '',
  UNIQUE(company_id,project_id,request_id,id),
  UNIQUE(company_id,project_id,id),
  FOREIGN KEY(company_id,project_id,request_id) REFERENCES public.material_requests(company_id,project_id,id),
  FOREIGN KEY(company_id,material_id) REFERENCES public.materials(company_id,id),
  FOREIGN KEY(company_id,project_id,budget_item_id) REFERENCES public.budget_items(company_id,project_id,id)
);
CREATE UNIQUE INDEX material_request_items_material_uidx
  ON public.material_request_items(company_id,project_id,request_id,material_id,coalesce(budget_item_id,'00000000-0000-0000-0000-000000000000'::uuid))
  WHERE deleted_at IS NULL;
CREATE INDEX material_request_items_budget_idx ON public.material_request_items(company_id,project_id,budget_item_id) WHERE deleted_at IS NULL AND budget_item_id IS NOT NULL;

CREATE TABLE public.inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL,
  number text NOT NULL CHECK(length(trim(number)) BETWEEN 1 AND 70),
  movement_type text NOT NULL CHECK(movement_type IN ('receipt','issue','transfer','adjustment_in','adjustment_out')),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','posted','cancelled')),
  source_warehouse_id uuid,
  target_warehouse_id uuid,
  material_request_id uuid,
  purchase_order_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  notes text NOT NULL DEFAULT '',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  posted_at timestamptz,
  UNIQUE(company_id,project_id,id),
  FOREIGN KEY(company_id,project_id) REFERENCES public.projects(company_id,id),
  FOREIGN KEY(company_id,project_id,source_warehouse_id) REFERENCES public.warehouses(company_id,project_id,id),
  FOREIGN KEY(company_id,project_id,target_warehouse_id) REFERENCES public.warehouses(company_id,project_id,id),
  FOREIGN KEY(company_id,project_id,material_request_id) REFERENCES public.material_requests(company_id,project_id,id),
  FOREIGN KEY(company_id,project_id,purchase_order_id) REFERENCES public.purchase_orders(company_id,project_id,id),
  FOREIGN KEY(company_id,created_by) REFERENCES public.profiles(company_id,user_id),
  CHECK(source_warehouse_id IS NULL OR target_warehouse_id IS NULL OR source_warehouse_id<>target_warehouse_id)
);
CREATE UNIQUE INDEX inventory_transactions_number_uidx ON public.inventory_transactions(company_id,project_id,number) WHERE deleted_at IS NULL;
CREATE INDEX inventory_transactions_project_date_idx ON public.inventory_transactions(company_id,project_id,occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX inventory_transactions_source_idx ON public.inventory_transactions(company_id,project_id,source_warehouse_id) WHERE deleted_at IS NULL AND source_warehouse_id IS NOT NULL;
CREATE INDEX inventory_transactions_target_idx ON public.inventory_transactions(company_id,project_id,target_warehouse_id) WHERE deleted_at IS NULL AND target_warehouse_id IS NOT NULL;
CREATE INDEX inventory_transactions_creator_idx ON public.inventory_transactions(company_id,created_by);
CREATE INDEX inventory_transactions_request_idx ON public.inventory_transactions(company_id,project_id,material_request_id) WHERE deleted_at IS NULL AND material_request_id IS NOT NULL;
CREATE INDEX inventory_transactions_po_idx ON public.inventory_transactions(company_id,project_id,purchase_order_id) WHERE deleted_at IS NULL AND purchase_order_id IS NOT NULL;

CREATE TABLE public.inventory_transaction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  material_id uuid NOT NULL,
  request_item_id uuid,
  purchase_order_item_id uuid,
  budget_item_id uuid,
  quantity numeric(18,4) NOT NULL CHECK(quantity>0),
  unit_cost numeric(18,4) NOT NULL DEFAULT 0 CHECK(unit_cost>=0),
  line_value numeric(18,2) GENERATED ALWAYS AS (round(quantity*unit_cost,2)) STORED,
  notes text NOT NULL DEFAULT '',
  UNIQUE(company_id,project_id,transaction_id,id),
  FOREIGN KEY(company_id,project_id,transaction_id) REFERENCES public.inventory_transactions(company_id,project_id,id),
  FOREIGN KEY(company_id,material_id) REFERENCES public.materials(company_id,id),
  FOREIGN KEY(company_id,project_id,request_item_id) REFERENCES public.material_request_items(company_id,project_id,id),
  FOREIGN KEY(company_id,project_id,budget_item_id) REFERENCES public.budget_items(company_id,project_id,id),
  FOREIGN KEY(company_id,purchase_order_item_id) REFERENCES public.purchase_order_items(company_id,id)
);
CREATE INDEX inventory_transaction_items_tx_idx ON public.inventory_transaction_items(company_id,project_id,transaction_id) WHERE deleted_at IS NULL;
CREATE INDEX inventory_transaction_items_material_idx ON public.inventory_transaction_items(company_id,project_id,material_id) WHERE deleted_at IS NULL;
CREATE INDEX inventory_transaction_items_request_idx ON public.inventory_transaction_items(company_id,project_id,request_item_id) WHERE deleted_at IS NULL AND request_item_id IS NOT NULL;
CREATE INDEX inventory_transaction_items_po_idx ON public.inventory_transaction_items(company_id,project_id,purchase_order_item_id) WHERE deleted_at IS NULL AND purchase_order_item_id IS NOT NULL;
CREATE INDEX inventory_transaction_items_budget_idx ON public.inventory_transaction_items(company_id,project_id,budget_item_id) WHERE deleted_at IS NULL AND budget_item_id IS NOT NULL;

ALTER TABLE public.purchase_order_items
  ADD COLUMN material_id uuid,
  ADD CONSTRAINT purchase_order_items_material_fk FOREIGN KEY(company_id,material_id) REFERENCES public.materials(company_id,id);
CREATE INDEX purchase_order_items_material_idx ON public.purchase_order_items(company_id,material_id) WHERE deleted_at IS NULL AND material_id IS NOT NULL;

CREATE FUNCTION mgl_private.material_request_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF auth.uid() IS NOT NULL AND NEW.requested_by<>auth.uid() THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: invalid material request requester';
    END IF;
    IF NEW.status<>'draft' THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: material requests start as draft';
    END IF;
  ELSE
    IF NEW.requested_by<>OLD.requested_by THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: material request requester is immutable';
    END IF;
    IF OLD.status<>'draft' AND
      (to_jsonb(NEW)-ARRAY['status','approved_by','approved_at','notes','updated_at','server_updated_at','mutation_id'])
      IS DISTINCT FROM
      (to_jsonb(OLD)-ARRAY['status','approved_by','approved_at','notes','updated_at','server_updated_at','mutation_id']) THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: submitted material request header is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER material_request_guard BEFORE INSERT OR UPDATE ON public.material_requests
FOR EACH ROW EXECUTE FUNCTION mgl_private.material_request_guard();

CREATE FUNCTION mgl_private.material_request_item_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_status text; v_requester uuid; v_item_type text; v_budget_status text;
BEGIN
  IF TG_OP='UPDATE' AND (NEW.request_id<>OLD.request_id OR NEW.material_id<>OLD.material_id) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: request line identity is immutable';
  END IF;
  SELECT r.status,r.requested_by INTO v_status,v_requester
  FROM public.material_requests r
  WHERE r.company_id=NEW.company_id AND r.project_id=NEW.project_id AND r.id=NEW.request_id AND r.deleted_at IS NULL
  FOR UPDATE;
  IF v_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: request lines are editable only in drafts';
  END IF;
  IF mgl_private.company_role(NEW.company_id)='field_worker' AND v_requester IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: workers edit only their own material requests';
  END IF;
  IF NEW.budget_item_id IS NOT NULL THEN
    SELECT i.item_type,b.status INTO v_item_type,v_budget_status
    FROM public.budget_items i JOIN public.project_budgets b
      ON b.company_id=i.company_id AND b.project_id=i.project_id AND b.id=i.budget_id
    WHERE i.company_id=NEW.company_id AND i.project_id=NEW.project_id AND i.id=NEW.budget_item_id
      AND i.deleted_at IS NULL AND b.deleted_at IS NULL;
    IF v_item_type IS DISTINCT FROM 'item' OR v_budget_status IS DISTINCT FROM 'baseline' THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: request cost code must be a leaf item from the active baseline';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER material_request_item_guard BEFORE INSERT OR UPDATE ON public.material_request_items
FOR EACH ROW EXECUTE FUNCTION mgl_private.material_request_item_guard();

CREATE FUNCTION mgl_private.inventory_transaction_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.status<>'draft' AND
    (to_jsonb(NEW)-ARRAY['status','posted_at','updated_at','server_updated_at','mutation_id'])
    IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['status','posted_at','updated_at','server_updated_at','mutation_id']) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: posted inventory transaction is immutable';
  END IF;
  IF NEW.movement_type IN ('receipt','adjustment_in') AND (NEW.source_warehouse_id IS NOT NULL OR NEW.target_warehouse_id IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: receipt/adjustment_in require only a target warehouse';
  ELSIF NEW.movement_type IN ('issue','adjustment_out') AND (NEW.source_warehouse_id IS NULL OR NEW.target_warehouse_id IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: issue/adjustment_out require only a source warehouse';
  ELSIF NEW.movement_type='transfer' AND (NEW.source_warehouse_id IS NULL OR NEW.target_warehouse_id IS NULL OR NEW.source_warehouse_id=NEW.target_warehouse_id) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: transfer requires different source and target warehouses';
  END IF;
  IF NEW.purchase_order_id IS NOT NULL AND NEW.movement_type<>'receipt' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: purchase order can reference only a receipt';
  END IF;
  IF NEW.material_request_id IS NOT NULL AND NEW.movement_type<>'issue' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: material request can reference only an issue';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER inventory_transaction_guard BEFORE INSERT OR UPDATE ON public.inventory_transactions
FOR EACH ROW EXECUTE FUNCTION mgl_private.inventory_transaction_guard();

CREATE FUNCTION mgl_private.inventory_transaction_item_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_status text; v_type text; v_request uuid; v_po uuid; v_request_material uuid; v_request_budget uuid; v_po_material uuid; v_po_budget uuid;
BEGIN
  IF TG_OP='UPDATE' AND (NEW.transaction_id<>OLD.transaction_id OR NEW.material_id<>OLD.material_id) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: inventory line identity is immutable';
  END IF;
  SELECT t.status,t.movement_type,t.material_request_id,t.purchase_order_id INTO v_status,v_type,v_request,v_po
  FROM public.inventory_transactions t
  WHERE t.company_id=NEW.company_id AND t.project_id=NEW.project_id AND t.id=NEW.transaction_id AND t.deleted_at IS NULL
  FOR UPDATE;
  IF v_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: inventory lines are editable only in drafts';
  END IF;
  IF v_request IS NOT NULL AND NEW.request_item_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: issue linked to a material request requires request_item_id';
  END IF;
  IF v_po IS NOT NULL AND NEW.purchase_order_item_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: receipt linked to a purchase order requires purchase_order_item_id';
  END IF;
  IF NEW.request_item_id IS NOT NULL THEN
    IF v_type<>'issue' OR v_request IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: request line requires an issue linked to a material request';
    END IF;
    SELECT material_id,budget_item_id INTO v_request_material,v_request_budget
    FROM public.material_request_items
    WHERE company_id=NEW.company_id AND project_id=NEW.project_id AND request_id=v_request AND id=NEW.request_item_id AND deleted_at IS NULL;
    IF v_request_material IS DISTINCT FROM NEW.material_id THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: inventory material does not match requested material';
    END IF;
    IF v_request_budget IS NOT NULL THEN NEW.budget_item_id:=v_request_budget; END IF;
  END IF;
  IF NEW.purchase_order_item_id IS NOT NULL THEN
    IF v_type<>'receipt' OR v_po IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: purchase line requires a receipt linked to a purchase order';
    END IF;
    SELECT material_id,budget_item_id INTO v_po_material,v_po_budget
    FROM public.purchase_order_items
    WHERE company_id=NEW.company_id AND project_id=NEW.project_id AND purchase_order_id=v_po AND id=NEW.purchase_order_item_id AND deleted_at IS NULL;
    IF v_po_material IS NULL OR v_po_material IS DISTINCT FROM NEW.material_id THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: purchase line material does not match inventory material';
    END IF;
    IF v_po_budget IS NOT NULL THEN NEW.budget_item_id:=v_po_budget; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER inventory_transaction_item_guard BEFORE INSERT OR UPDATE ON public.inventory_transaction_items
FOR EACH ROW EXECUTE FUNCTION mgl_private.inventory_transaction_item_guard();

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transaction_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.materials,public.warehouses,public.material_requests,public.material_request_items,public.inventory_transactions,public.inventory_transaction_items FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.materials,public.warehouses,public.material_requests,public.material_request_items,public.inventory_transactions,public.inventory_transaction_items TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.materials,public.warehouses,public.material_requests,public.material_request_items,public.inventory_transactions,public.inventory_transaction_items TO service_role;

CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.materials FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.material_requests FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.material_request_items FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.inventory_transactions FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.inventory_transaction_items FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();

CREATE POLICY materials_read ON public.materials FOR SELECT TO authenticated USING(mgl_private.company_role(company_id) IS NOT NULL);
CREATE POLICY materials_insert ON public.materials FOR INSERT TO authenticated WITH CHECK(mgl_private.company_role(company_id) IN ('admin','pm'));
CREATE POLICY materials_update ON public.materials FOR UPDATE TO authenticated USING(mgl_private.company_role(company_id) IN ('admin','pm')) WITH CHECK(mgl_private.company_role(company_id) IN ('admin','pm'));
GRANT INSERT(id,company_id,sku,name,category,unit_code,min_stock,notes,updated_at,mutation_id),
 UPDATE(sku,name,category,unit_code,min_stock,notes,deleted_at,updated_at,mutation_id) ON public.materials TO authenticated;

CREATE POLICY warehouses_read ON public.warehouses FOR SELECT TO authenticated USING(mgl_private.project_access(company_id,project_id));
CREATE POLICY warehouses_insert ON public.warehouses FOR INSERT TO authenticated WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]));
CREATE POLICY warehouses_update ON public.warehouses FOR UPDATE TO authenticated USING(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[])) WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]));
GRANT INSERT(id,company_id,project_id,code,name,location,responsible_id,updated_at,mutation_id),
 UPDATE(code,name,location,responsible_id,deleted_at,updated_at,mutation_id) ON public.warehouses TO authenticated;

CREATE POLICY material_requests_read ON public.material_requests FOR SELECT TO authenticated USING(mgl_private.project_access(company_id,project_id));
CREATE POLICY material_requests_insert ON public.material_requests FOR INSERT TO authenticated WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor','field_worker']::public.app_role[]) AND requested_by=(select auth.uid()) AND status='draft');
CREATE POLICY material_requests_update ON public.material_requests FOR UPDATE TO authenticated
USING(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[]) OR (mgl_private.project_write(company_id,project_id,ARRAY['field_worker']::public.app_role[]) AND requested_by=(select auth.uid()) AND status='draft'))
WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[]) OR (mgl_private.project_write(company_id,project_id,ARRAY['field_worker']::public.app_role[]) AND requested_by=(select auth.uid())));
GRANT INSERT(id,company_id,project_id,number,needed_on,notes,requested_by,updated_at,mutation_id),
 UPDATE(number,needed_on,notes,deleted_at,updated_at,mutation_id) ON public.material_requests TO authenticated;

CREATE POLICY material_request_items_read ON public.material_request_items FOR SELECT TO authenticated USING(mgl_private.project_access(company_id,project_id));
CREATE POLICY material_request_items_insert ON public.material_request_items FOR INSERT TO authenticated WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor','field_worker']::public.app_role[]));
CREATE POLICY material_request_items_update ON public.material_request_items FOR UPDATE TO authenticated USING(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor','field_worker']::public.app_role[])) WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor','field_worker']::public.app_role[]));
GRANT INSERT(id,company_id,project_id,request_id,material_id,budget_item_id,quantity,notes,updated_at,mutation_id),
 UPDATE(budget_item_id,quantity,notes,deleted_at,updated_at,mutation_id) ON public.material_request_items TO authenticated;

CREATE POLICY inventory_transactions_read ON public.inventory_transactions FOR SELECT TO authenticated USING(mgl_private.project_access(company_id,project_id));
CREATE POLICY inventory_transactions_insert ON public.inventory_transactions FOR INSERT TO authenticated WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[]) AND created_by=(select auth.uid()) AND status='draft');
CREATE POLICY inventory_transactions_update ON public.inventory_transactions FOR UPDATE TO authenticated USING(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[]) AND status='draft') WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[]));
GRANT INSERT(id,company_id,project_id,number,movement_type,source_warehouse_id,target_warehouse_id,material_request_id,purchase_order_id,occurred_at,notes,created_by,updated_at,mutation_id),
 UPDATE(number,source_warehouse_id,target_warehouse_id,material_request_id,purchase_order_id,occurred_at,notes,deleted_at,updated_at,mutation_id) ON public.inventory_transactions TO authenticated;

CREATE POLICY inventory_transaction_items_read ON public.inventory_transaction_items FOR SELECT TO authenticated USING(mgl_private.project_access(company_id,project_id));
CREATE POLICY inventory_transaction_items_insert ON public.inventory_transaction_items FOR INSERT TO authenticated WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[]));
CREATE POLICY inventory_transaction_items_update ON public.inventory_transaction_items FOR UPDATE TO authenticated USING(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[])) WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[]));
GRANT INSERT(id,company_id,project_id,transaction_id,material_id,request_item_id,purchase_order_item_id,budget_item_id,quantity,unit_cost,notes,updated_at,mutation_id),
 UPDATE(request_item_id,purchase_order_item_id,budget_item_id,quantity,unit_cost,notes,deleted_at,updated_at,mutation_id) ON public.inventory_transaction_items TO authenticated;

GRANT UPDATE(material_id,updated_at,mutation_id) ON public.purchase_order_items TO authenticated;

CREATE VIEW public.inventory_stock WITH(security_invoker=true) AS
WITH ledger AS (
  SELECT t.company_id,t.project_id,t.target_warehouse_id AS warehouse_id,i.material_id,i.quantity AS quantity_delta,i.line_value AS value_delta
  FROM public.inventory_transactions t JOIN public.inventory_transaction_items i
    ON i.company_id=t.company_id AND i.project_id=t.project_id AND i.transaction_id=t.id
  WHERE t.status='posted' AND t.deleted_at IS NULL AND i.deleted_at IS NULL AND t.movement_type IN ('receipt','adjustment_in')
  UNION ALL
  SELECT t.company_id,t.project_id,t.source_warehouse_id,i.material_id,-i.quantity,-i.line_value
  FROM public.inventory_transactions t JOIN public.inventory_transaction_items i
    ON i.company_id=t.company_id AND i.project_id=t.project_id AND i.transaction_id=t.id
  WHERE t.status='posted' AND t.deleted_at IS NULL AND i.deleted_at IS NULL AND t.movement_type IN ('issue','adjustment_out')
  UNION ALL
  SELECT t.company_id,t.project_id,t.source_warehouse_id,i.material_id,-i.quantity,-i.line_value
  FROM public.inventory_transactions t JOIN public.inventory_transaction_items i
    ON i.company_id=t.company_id AND i.project_id=t.project_id AND i.transaction_id=t.id
  WHERE t.status='posted' AND t.deleted_at IS NULL AND i.deleted_at IS NULL AND t.movement_type='transfer'
  UNION ALL
  SELECT t.company_id,t.project_id,t.target_warehouse_id,i.material_id,i.quantity,i.line_value
  FROM public.inventory_transactions t JOIN public.inventory_transaction_items i
    ON i.company_id=t.company_id AND i.project_id=t.project_id AND i.transaction_id=t.id
  WHERE t.status='posted' AND t.deleted_at IS NULL AND i.deleted_at IS NULL AND t.movement_type='transfer'
)
SELECT l.company_id,l.project_id,l.warehouse_id,l.material_id,
  round(sum(l.quantity_delta),4)::numeric(18,4) AS quantity,
  round(sum(l.value_delta),2)::numeric(18,2) AS stock_value,
  CASE WHEN sum(l.quantity_delta)>0 THEN round(sum(l.value_delta)/sum(l.quantity_delta),4) ELSE 0 END::numeric(18,4) AS average_unit_cost
FROM ledger l
WHERE l.warehouse_id IS NOT NULL
GROUP BY l.company_id,l.project_id,l.warehouse_id,l.material_id;

CREATE VIEW public.material_request_fulfillment WITH(security_invoker=true) AS
WITH issued AS (
  SELECT t.company_id,t.project_id,t.material_request_id AS request_id,i.request_item_id,
    sum(i.quantity)::numeric(18,4) AS fulfilled_quantity
  FROM public.inventory_transactions t JOIN public.inventory_transaction_items i
    ON i.company_id=t.company_id AND i.project_id=t.project_id AND i.transaction_id=t.id
  WHERE t.status='posted' AND t.movement_type='issue' AND t.deleted_at IS NULL AND i.deleted_at IS NULL
    AND t.material_request_id IS NOT NULL AND i.request_item_id IS NOT NULL
  GROUP BY t.company_id,t.project_id,t.material_request_id,i.request_item_id
)
SELECT r.id AS request_id,r.company_id,r.project_id,r.number,r.status,r.needed_on,r.requested_by,
  i.id AS request_item_id,i.material_id,i.budget_item_id,i.quantity AS requested_quantity,
  coalesce(x.fulfilled_quantity,0)::numeric(18,4) AS fulfilled_quantity,
  greatest(i.quantity-coalesce(x.fulfilled_quantity,0),0)::numeric(18,4) AS remaining_quantity
FROM public.material_requests r JOIN public.material_request_items i
  ON i.company_id=r.company_id AND i.project_id=r.project_id AND i.request_id=r.id
LEFT JOIN issued x ON x.company_id=i.company_id AND x.project_id=i.project_id AND x.request_id=i.request_id AND x.request_item_id=i.id
WHERE r.deleted_at IS NULL AND i.deleted_at IS NULL;

CREATE VIEW public.project_inventory_summary WITH(security_invoker=true) AS
WITH stock AS (
  SELECT company_id,project_id,
    coalesce(sum(stock_value),0)::numeric(18,2) AS stock_value,
    count(DISTINCT material_id) FILTER(WHERE quantity>0) AS sku_in_stock
  FROM public.inventory_stock
  GROUP BY company_id,project_id
), req AS (
  SELECT company_id,project_id,
    count(*) FILTER(WHERE status IN ('draft','submitted','approved')) AS open_requests,
    count(*) FILTER(WHERE status='approved') AS approved_requests
  FROM public.material_requests WHERE deleted_at IS NULL GROUP BY company_id,project_id
), wh AS (
  SELECT company_id,project_id,count(*) AS warehouse_count FROM public.warehouses WHERE deleted_at IS NULL GROUP BY company_id,project_id
), low AS (
  SELECT s.company_id,s.project_id,count(*) AS low_stock_count
  FROM (
    SELECT company_id,project_id,material_id,sum(quantity) AS quantity
    FROM public.inventory_stock GROUP BY company_id,project_id,material_id
  ) s JOIN public.materials m ON m.company_id=s.company_id AND m.id=s.material_id AND m.deleted_at IS NULL
  WHERE m.min_stock>0 AND s.quantity<m.min_stock
  GROUP BY s.company_id,s.project_id
)
SELECT p.id AS project_id,p.company_id,
  coalesce(stock.stock_value,0)::numeric(18,2) AS stock_value,
  coalesce(stock.sku_in_stock,0)::bigint AS sku_in_stock,
  coalesce(wh.warehouse_count,0)::bigint AS warehouse_count,
  coalesce(req.open_requests,0)::bigint AS open_requests,
  coalesce(req.approved_requests,0)::bigint AS approved_requests,
  coalesce(low.low_stock_count,0)::bigint AS low_stock_count
FROM public.projects p
LEFT JOIN stock ON stock.company_id=p.company_id AND stock.project_id=p.id
LEFT JOIN req ON req.company_id=p.company_id AND req.project_id=p.id
LEFT JOIN wh ON wh.company_id=p.company_id AND wh.project_id=p.id
LEFT JOIN low ON low.company_id=p.company_id AND low.project_id=p.id
WHERE p.deleted_at IS NULL AND mgl_private.project_access(p.company_id,p.id);

REVOKE ALL ON public.inventory_stock,public.material_request_fulfillment,public.project_inventory_summary FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.inventory_stock,public.material_request_fulfillment,public.project_inventory_summary TO authenticated,service_role;

CREATE FUNCTION mgl_private.transition_material_request(p_request_id uuid,p_target_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.material_requests; v_role public.app_role;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='MGL: authentication required'; END IF;
  IF p_target_status NOT IN ('submitted','approved','rejected','cancelled') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MGL: unsupported material request status';
  END IF;
  SELECT * INTO r FROM public.material_requests WHERE id=p_request_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT mgl_private.project_access(r.company_id,r.project_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: material request access required';
  END IF;
  v_role:=mgl_private.company_role(r.company_id);
  IF p_target_status='submitted' THEN
    IF r.status NOT IN ('draft') OR (r.requested_by<>auth.uid() AND v_role NOT IN ('admin','pm','supervisor')) THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: cannot submit this material request';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.material_request_items i WHERE i.company_id=r.company_id AND i.project_id=r.project_id AND i.request_id=r.id AND i.deleted_at IS NULL) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: material request requires at least one line';
    END IF;
  ELSIF p_target_status IN ('approved','rejected') THEN
    IF r.status<>'submitted' OR v_role NOT IN ('admin','pm','supervisor') THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: manager approval required';
    END IF;
  ELSIF p_target_status='cancelled' THEN
    IF r.status NOT IN ('draft','submitted','approved') OR (r.requested_by<>auth.uid() AND v_role NOT IN ('admin','pm','supervisor')) THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: cannot cancel this material request';
    END IF;
  END IF;
  UPDATE public.material_requests SET status=p_target_status,
    approved_by=CASE WHEN p_target_status='approved' THEN auth.uid() ELSE approved_by END,
    approved_at=CASE WHEN p_target_status='approved' THEN clock_timestamp() ELSE approved_at END,
    updated_at=clock_timestamp(),mutation_id=gen_random_uuid()
  WHERE id=r.id RETURNING * INTO r;
  RETURN jsonb_build_object('id',r.id,'status',r.status,'approved_by',r.approved_by,'approved_at',r.approved_at);
END;
$$;
CREATE FUNCTION public.transition_material_request(p_request_id uuid,p_target_status text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT mgl_private.transition_material_request(p_request_id,p_target_status); $$;
REVOKE ALL ON FUNCTION public.transition_material_request(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transition_material_request(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION mgl_private.transition_material_request(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION mgl_private.transition_material_request(uuid,text) TO authenticated;

CREATE FUNCTION mgl_private.post_inventory_transaction(p_transaction_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.inventory_transactions; li public.inventory_transaction_items; v_role public.app_role;
  v_stock_qty numeric; v_stock_value numeric; v_avg numeric; v_ref_qty numeric; v_already numeric; v_tx_qty numeric;
  v_po_status text; v_request_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='MGL: authentication required'; END IF;
  SELECT * INTO t FROM public.inventory_transactions WHERE id=p_transaction_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT mgl_private.project_write(t.company_id,t.project_id,ARRAY['admin','pm','supervisor']::public.app_role[]) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: inventory manager access required';
  END IF;
  IF t.status<>'draft' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: only draft inventory transactions can be posted'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.inventory_transaction_items i WHERE i.company_id=t.company_id AND i.project_id=t.project_id AND i.transaction_id=t.id AND i.deleted_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: inventory transaction requires at least one line';
  END IF;

  IF t.purchase_order_id IS NOT NULL THEN
    SELECT status INTO v_po_status FROM public.purchase_orders WHERE company_id=t.company_id AND project_id=t.project_id AND id=t.purchase_order_id AND deleted_at IS NULL;
    IF v_po_status NOT IN ('issued','received') THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: receipt purchase order must be issued or received'; END IF;
  END IF;
  IF t.material_request_id IS NOT NULL THEN
    SELECT status INTO v_request_status FROM public.material_requests WHERE company_id=t.company_id AND project_id=t.project_id AND id=t.material_request_id AND deleted_at IS NULL FOR UPDATE;
    IF v_request_status<>'approved' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: stock issue requires an approved material request'; END IF;
  END IF;

  FOR li IN SELECT * FROM public.inventory_transaction_items i
    WHERE i.company_id=t.company_id AND i.project_id=t.project_id AND i.transaction_id=t.id AND i.deleted_at IS NULL FOR UPDATE
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(t.project_id::text||':'||li.material_id::text,71));

    IF t.movement_type='receipt' AND li.purchase_order_item_id IS NOT NULL THEN
      SELECT p.quantity,p.unit_price INTO v_ref_qty,v_avg FROM public.purchase_order_items p
      WHERE p.company_id=t.company_id AND p.project_id=t.project_id AND p.purchase_order_id=t.purchase_order_id
        AND p.id=li.purchase_order_item_id AND p.material_id=li.material_id AND p.deleted_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: invalid purchase order line for receipt'; END IF;
      SELECT coalesce(sum(x.quantity),0) INTO v_already
      FROM public.inventory_transaction_items x JOIN public.inventory_transactions h
        ON h.company_id=x.company_id AND h.project_id=x.project_id AND h.id=x.transaction_id
      WHERE x.company_id=t.company_id AND x.project_id=t.project_id AND x.purchase_order_item_id=li.purchase_order_item_id
        AND x.deleted_at IS NULL AND h.deleted_at IS NULL AND h.status='posted' AND h.movement_type='receipt';
      SELECT coalesce(sum(x.quantity),0) INTO v_tx_qty FROM public.inventory_transaction_items x
      WHERE x.company_id=t.company_id AND x.project_id=t.project_id AND x.transaction_id=t.id
        AND x.purchase_order_item_id=li.purchase_order_item_id AND x.deleted_at IS NULL;
      IF v_already+v_tx_qty>v_ref_qty THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: receipt exceeds purchase order quantity'; END IF;
      UPDATE public.inventory_transaction_items SET unit_cost=v_avg,updated_at=clock_timestamp(),mutation_id=gen_random_uuid() WHERE id=li.id;
    ELSIF t.movement_type IN ('issue','transfer','adjustment_out') THEN
      SELECT coalesce(s.quantity,0),coalesce(s.stock_value,0),coalesce(s.average_unit_cost,0)
        INTO v_stock_qty,v_stock_value,v_avg
      FROM public.inventory_stock s
      WHERE s.company_id=t.company_id AND s.project_id=t.project_id AND s.warehouse_id=t.source_warehouse_id AND s.material_id=li.material_id;
      IF NOT FOUND THEN v_stock_qty:=0;v_stock_value:=0;v_avg:=0; END IF;
      SELECT coalesce(sum(x.quantity),0) INTO v_tx_qty FROM public.inventory_transaction_items x
      WHERE x.company_id=t.company_id AND x.project_id=t.project_id AND x.transaction_id=t.id
        AND x.material_id=li.material_id AND x.deleted_at IS NULL;
      IF v_stock_qty<v_tx_qty THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: insufficient stock'; END IF;
      UPDATE public.inventory_transaction_items SET unit_cost=v_avg,updated_at=clock_timestamp(),mutation_id=gen_random_uuid() WHERE id=li.id;
    END IF;

    IF t.movement_type='issue' AND li.request_item_id IS NOT NULL THEN
      SELECT i.quantity INTO v_ref_qty FROM public.material_request_items i
      WHERE i.company_id=t.company_id AND i.project_id=t.project_id AND i.request_id=t.material_request_id AND i.id=li.request_item_id AND i.material_id=li.material_id AND i.deleted_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: invalid material request line for issue'; END IF;
      SELECT coalesce(sum(x.quantity),0) INTO v_already
      FROM public.inventory_transaction_items x JOIN public.inventory_transactions h
        ON h.company_id=x.company_id AND h.project_id=x.project_id AND h.id=x.transaction_id
      WHERE x.company_id=t.company_id AND x.project_id=t.project_id AND x.request_item_id=li.request_item_id
        AND x.deleted_at IS NULL AND h.deleted_at IS NULL AND h.status='posted' AND h.movement_type='issue';
      SELECT coalesce(sum(x.quantity),0) INTO v_tx_qty FROM public.inventory_transaction_items x
      WHERE x.company_id=t.company_id AND x.project_id=t.project_id AND x.transaction_id=t.id
        AND x.request_item_id=li.request_item_id AND x.deleted_at IS NULL;
      IF v_already+v_tx_qty>v_ref_qty THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: issue exceeds requested quantity'; END IF;
    END IF;
  END LOOP;

  UPDATE public.inventory_transactions SET status='posted',posted_at=clock_timestamp(),updated_at=clock_timestamp(),mutation_id=gen_random_uuid() WHERE id=t.id RETURNING * INTO t;

  IF t.material_request_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.material_request_fulfillment f WHERE f.request_id=t.material_request_id AND f.remaining_quantity>0
  ) THEN
    UPDATE public.material_requests SET status='fulfilled',updated_at=clock_timestamp(),mutation_id=gen_random_uuid() WHERE id=t.material_request_id AND status='approved';
  END IF;

  RETURN jsonb_build_object('id',t.id,'status',t.status,'movement_type',t.movement_type,'posted_at',t.posted_at);
END;
$$;
CREATE FUNCTION public.post_inventory_transaction(p_transaction_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT mgl_private.post_inventory_transaction(p_transaction_id); $$;
REVOKE ALL ON FUNCTION public.post_inventory_transaction(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.post_inventory_transaction(uuid) TO authenticated;
REVOKE ALL ON FUNCTION mgl_private.post_inventory_transaction(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION mgl_private.post_inventory_transaction(uuid) TO authenticated;
