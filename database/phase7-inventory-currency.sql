-- Fase 7: el inventario valorizado usa la moneda base de la empresa.
-- Órdenes en otra moneda siguen permitidas para compras no controladas por stock.

CREATE FUNCTION mgl_private.purchase_item_inventory_currency_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_order_currency text;
  v_company_currency text;
BEGIN
  IF NEW.material_id IS NULL THEN RETURN NEW; END IF;

  SELECT h.currency,c.currency INTO v_order_currency,v_company_currency
  FROM public.purchase_orders h
  JOIN public.companies c ON c.id=h.company_id
  WHERE h.company_id=NEW.company_id AND h.project_id=NEW.project_id AND h.id=NEW.purchase_order_id
    AND h.deleted_at IS NULL AND c.deleted_at IS NULL;

  IF v_order_currency IS NULL OR v_company_currency IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: purchase order currency context not found';
  END IF;
  IF v_order_currency<>v_company_currency THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: stock-controlled purchase lines must use company base currency';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER purchase_item_inventory_currency_guard
BEFORE INSERT OR UPDATE ON public.purchase_order_items
FOR EACH ROW EXECUTE FUNCTION mgl_private.purchase_item_inventory_currency_guard();

CREATE FUNCTION mgl_private.purchase_order_inventory_currency_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_company_currency text;
BEGIN
  IF TG_OP='UPDATE' AND NEW.currency IS DISTINCT FROM OLD.currency THEN
    SELECT c.currency INTO v_company_currency
    FROM public.companies c WHERE c.id=NEW.company_id AND c.deleted_at IS NULL;
    IF NEW.currency<>v_company_currency AND EXISTS(
      SELECT 1 FROM public.purchase_order_items i
      WHERE i.company_id=NEW.company_id AND i.project_id=NEW.project_id
        AND i.purchase_order_id=NEW.id AND i.material_id IS NOT NULL AND i.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: cannot change a stock-controlled order away from company base currency';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER purchase_order_inventory_currency_guard
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION mgl_private.purchase_order_inventory_currency_guard();

REVOKE ALL ON FUNCTION mgl_private.purchase_item_inventory_currency_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION mgl_private.purchase_order_inventory_currency_guard() FROM PUBLIC,anon,authenticated;
