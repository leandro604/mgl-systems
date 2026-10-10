-- MGL Systems / Fase 5
-- Compras, proveedores, control económico y cola fiscal SUNAT/PSE-ready.
-- Aplicar después de Fase 1 + Fase 3 en instalaciones nuevas.

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  legal_name text NOT NULL CHECK(length(trim(legal_name)) BETWEEN 2 AND 200),
  ruc text CHECK(ruc IS NULL OR ruc ~ '^[0-9]{11}$'),
  contact_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'PEN' CHECK(currency IN ('PEN','USD')),
  UNIQUE(company_id,id)
);
CREATE UNIQUE INDEX suppliers_company_ruc_active_uidx
  ON public.suppliers(company_id,ruc)
  WHERE deleted_at IS NULL AND ruc IS NOT NULL;
CREATE INDEX suppliers_company_name_idx ON public.suppliers(company_id,legal_name) WHERE deleted_at IS NULL;

ALTER TABLE public.purchase_orders
  ADD COLUMN supplier_id uuid,
  ADD COLUMN ordered_on date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN expected_on date,
  ADD COLUMN received_on date,
  ADD COLUMN notes text NOT NULL DEFAULT '',
  ADD CONSTRAINT purchase_orders_supplier_fk
    FOREIGN KEY(company_id,supplier_id) REFERENCES public.suppliers(company_id,id),
  ADD CONSTRAINT purchase_orders_dates_ck
    CHECK(expected_on IS NULL OR expected_on >= ordered_on),
  ADD CONSTRAINT purchase_orders_received_ck
    CHECK(status <> 'received' OR received_on IS NOT NULL);

CREATE INDEX purchase_orders_supplier_idx
  ON public.purchase_orders(company_id,supplier_id)
  WHERE deleted_at IS NULL;

CREATE TABLE public.fiscal_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  document_type text NOT NULL CHECK(document_type IN ('01','03')),
  series text NOT NULL,
  next_number bigint NOT NULL DEFAULT 1 CHECK(next_number > 0),
  active boolean NOT NULL DEFAULT true,
  last_issued_at timestamptz,
  UNIQUE(company_id,id),
  CHECK((document_type='01' AND series ~ '^F[A-Z0-9]{3}$') OR (document_type='03' AND series ~ '^B[A-Z0-9]{3}$'))
);
CREATE UNIQUE INDEX fiscal_series_active_uidx
  ON public.fiscal_series(company_id,document_type,series)
  WHERE deleted_at IS NULL;
CREATE INDEX fiscal_series_company_idx ON public.fiscal_series(company_id,document_type,active)
  WHERE deleted_at IS NULL;

CREATE FUNCTION mgl_private.purchase_order_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_supplier_name text;
  v_supplier_ruc text;
BEGIN
  IF TG_OP='INSERT' OR (TG_OP='UPDATE' AND OLD.status='draft') THEN
    IF NEW.supplier_id IS NOT NULL THEN
      SELECT s.legal_name,s.ruc INTO v_supplier_name,v_supplier_ruc
      FROM public.suppliers s
      WHERE s.company_id=NEW.company_id AND s.id=NEW.supplier_id AND s.deleted_at IS NULL;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: supplier is inactive or belongs to another company';
      END IF;
      NEW.supplier_name := v_supplier_name;
      NEW.supplier_ruc := v_supplier_ruc;
    END IF;
  END IF;

  IF length(trim(NEW.supplier_name)) < 2 THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: supplier name is required';
  END IF;

  IF TG_OP='UPDATE' AND OLD.status<>'draft' AND
    (to_jsonb(NEW)-ARRAY['status','received_on','updated_at','server_updated_at','mutation_id'])
    IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['status','received_on','updated_at','server_updated_at','mutation_id']) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: issued purchase order header is immutable';
  END IF;

  IF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status='draft' AND NEW.status IN ('issued','cancelled')) OR
      (OLD.status='issued' AND NEW.status IN ('received','cancelled'))
    ) THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: invalid purchase order transition';
    END IF;
    IF NEW.status='issued' AND NOT EXISTS(
      SELECT 1 FROM public.purchase_order_items l
      WHERE l.company_id=NEW.company_id AND l.project_id=NEW.project_id
        AND l.purchase_order_id=NEW.id AND l.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: purchase order requires at least one active line';
    END IF;
    IF NEW.status='received' AND NEW.received_on IS NULL THEN
      NEW.received_on := CURRENT_DATE;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER purchase_order_guard
BEFORE INSERT OR UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION mgl_private.purchase_order_guard();

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.suppliers FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.suppliers TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.suppliers TO service_role;
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();
CREATE POLICY suppliers_read ON public.suppliers FOR SELECT TO authenticated
USING(mgl_private.company_role(company_id) IN ('admin','pm'));
CREATE POLICY suppliers_insert ON public.suppliers FOR INSERT TO authenticated
WITH CHECK(mgl_private.company_role(company_id) IN ('admin','pm'));
CREATE POLICY suppliers_update ON public.suppliers FOR UPDATE TO authenticated
USING(mgl_private.company_role(company_id) IN ('admin','pm'))
WITH CHECK(mgl_private.company_role(company_id) IN ('admin','pm'));
GRANT INSERT(id,company_id,legal_name,ruc,contact_name,email,phone,address,currency,updated_at,mutation_id),
 UPDATE(legal_name,ruc,contact_name,email,phone,address,currency,deleted_at,updated_at,mutation_id)
 ON public.suppliers TO authenticated;

ALTER TABLE public.fiscal_series ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fiscal_series FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.fiscal_series TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.fiscal_series TO service_role;
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.fiscal_series
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();
CREATE POLICY fiscal_series_read ON public.fiscal_series FOR SELECT TO authenticated
USING(mgl_private.company_role(company_id) IN ('admin','pm'));
CREATE POLICY fiscal_series_insert ON public.fiscal_series FOR INSERT TO authenticated
WITH CHECK(mgl_private.company_role(company_id)='admin');
CREATE POLICY fiscal_series_update ON public.fiscal_series FOR UPDATE TO authenticated
USING(mgl_private.company_role(company_id)='admin')
WITH CHECK(mgl_private.company_role(company_id)='admin');
GRANT INSERT(id,company_id,document_type,series,next_number,active,updated_at,mutation_id),
 UPDATE(active,deleted_at,updated_at,mutation_id)
 ON public.fiscal_series TO authenticated;

REVOKE UPDATE ON public.purchase_orders FROM authenticated;
GRANT UPDATE(number,supplier_id,supplier_name,supplier_ruc,currency,ordered_on,expected_on,notes,deleted_at,updated_at,mutation_id)
 ON public.purchase_orders TO authenticated;

CREATE FUNCTION mgl_private.transition_purchase_order(p_order_id uuid,p_target_status text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_order public.purchase_orders;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='MGL: authentication required';
  END IF;
  IF p_target_status NOT IN ('issued','received','cancelled') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: unsupported purchase order status';
  END IF;

  SELECT * INTO v_order FROM public.purchase_orders h
  WHERE h.id=p_order_id AND h.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND OR NOT mgl_private.project_write(v_order.company_id,v_order.project_id,ARRAY['admin','pm']::public.app_role[]) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: purchase order access required';
  END IF;

  UPDATE public.purchase_orders
  SET status=p_target_status,
      received_on=CASE WHEN p_target_status='received' THEN COALESCE(received_on,CURRENT_DATE) ELSE received_on END,
      updated_at=clock_timestamp(),
      mutation_id=gen_random_uuid()
  WHERE id=p_order_id
  RETURNING * INTO v_order;

  RETURN jsonb_build_object(
    'id',v_order.id,
    'status',v_order.status,
    'received_on',v_order.received_on,
    'server_updated_at',v_order.server_updated_at
  );
END;
$$;

CREATE FUNCTION public.transition_purchase_order(p_order_id uuid,p_target_status text)
RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT mgl_private.transition_purchase_order(p_order_id,p_target_status);
$$;
REVOKE ALL ON FUNCTION public.transition_purchase_order(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transition_purchase_order(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION mgl_private.transition_purchase_order(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION mgl_private.transition_purchase_order(uuid,text) TO authenticated;

CREATE FUNCTION mgl_private.queue_invoice(p_invoice_id uuid,p_series text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_invoice public.invoices;
  v_series public.fiscal_series;
  v_number bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='MGL: authentication required';
  END IF;

  SELECT * INTO v_invoice FROM public.invoices h
  WHERE h.id=p_invoice_id AND h.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND OR NOT mgl_private.project_write(v_invoice.company_id,v_invoice.project_id,ARRAY['admin','pm']::public.app_role[]) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: invoice access required';
  END IF;
  IF v_invoice.status <> 'draft' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: only draft invoices can be queued';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.invoice_items l
    WHERE l.company_id=v_invoice.company_id AND l.project_id=v_invoice.project_id
      AND l.invoice_id=v_invoice.id AND l.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: invoice requires at least one active line';
  END IF;

  SELECT * INTO v_series FROM public.fiscal_series s
  WHERE s.company_id=v_invoice.company_id
    AND s.document_type=v_invoice.document_type
    AND s.series=upper(trim(p_series))
    AND s.active
    AND s.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: active fiscal series not found';
  END IF;

  v_number := v_series.next_number;
  UPDATE public.fiscal_series
  SET next_number=next_number+1,
      last_issued_at=clock_timestamp(),
      updated_at=clock_timestamp(),
      mutation_id=gen_random_uuid()
  WHERE id=v_series.id;

  UPDATE public.invoices
  SET series=v_series.series,
      number=v_number,
      status='queued',
      updated_at=clock_timestamp(),
      mutation_id=gen_random_uuid()
  WHERE id=v_invoice.id
  RETURNING * INTO v_invoice;

  RETURN jsonb_build_object(
    'id',v_invoice.id,
    'document_type',v_invoice.document_type,
    'series',v_invoice.series,
    'number',v_invoice.number,
    'status',v_invoice.status,
    'queued_at',v_invoice.server_updated_at
  );
END;
$$;

CREATE FUNCTION public.queue_invoice(p_invoice_id uuid,p_series text)
RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT mgl_private.queue_invoice(p_invoice_id,p_series);
$$;
REVOKE ALL ON FUNCTION public.queue_invoice(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.queue_invoice(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION mgl_private.queue_invoice(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION mgl_private.queue_invoice(uuid,text) TO authenticated;

CREATE VIEW public.project_financial_summary WITH(security_invoker=true) AS
WITH po AS (
  SELECT h.company_id,h.project_id,
    coalesce(sum(CASE WHEN h.status IN ('issued','received') THEN t.total_amount ELSE 0 END),0) AS committed_cost,
    coalesce(sum(CASE WHEN h.status='received' THEN t.total_amount ELSE 0 END),0) AS received_cost,
    count(*) FILTER (WHERE h.status='draft') AS purchase_drafts,
    count(*) FILTER (WHERE h.status IN ('issued','received')) AS purchase_committed_count
  FROM public.purchase_orders h
  JOIN public.purchase_order_totals t ON t.id=h.id
  WHERE h.deleted_at IS NULL
  GROUP BY h.company_id,h.project_id
), inv AS (
  SELECT h.company_id,h.project_id,
    coalesce(sum(CASE WHEN h.status IN ('queued','processing','submitted','accepted','unknown') THEN t.total_amount ELSE 0 END),0) AS emitted_total,
    coalesce(sum(CASE WHEN h.status='accepted' THEN t.total_amount ELSE 0 END),0) AS accepted_revenue,
    count(*) FILTER (WHERE h.status='draft') AS invoice_drafts,
    count(*) FILTER (WHERE h.status='accepted') AS accepted_count
  FROM public.invoices h
  JOIN public.invoice_totals t ON t.id=h.id
  WHERE h.deleted_at IS NULL
  GROUP BY h.company_id,h.project_id
)
SELECT p.id AS project_id,p.company_id,
  coalesce(po.committed_cost,0) AS committed_cost,
  coalesce(po.received_cost,0) AS received_cost,
  coalesce(inv.emitted_total,0) AS emitted_total,
  coalesce(inv.accepted_revenue,0) AS accepted_revenue,
  coalesce(inv.accepted_revenue,0)-coalesce(po.received_cost,0) AS operational_margin,
  coalesce(po.purchase_drafts,0) AS purchase_drafts,
  coalesce(po.purchase_committed_count,0) AS purchase_committed_count,
  coalesce(inv.invoice_drafts,0) AS invoice_drafts,
  coalesce(inv.accepted_count,0) AS accepted_count
FROM public.projects p
LEFT JOIN po ON po.company_id=p.company_id AND po.project_id=p.id
LEFT JOIN inv ON inv.company_id=p.company_id AND inv.project_id=p.id
WHERE p.deleted_at IS NULL
  AND mgl_private.company_role(p.company_id) IN ('admin','pm');

REVOKE ALL ON public.project_financial_summary FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.project_financial_summary TO authenticated,service_role;
