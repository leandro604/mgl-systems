-- Fase 7: alta + contabilización de un movimiento en una sola transacción.
-- Evita encabezados/partidas huérfanos si una validación de stock o referencia falla.

CREATE FUNCTION mgl_private.create_inventory_movement(
  p_project_id uuid,
  p_number text,
  p_movement_type text,
  p_source_warehouse_id uuid,
  p_target_warehouse_id uuid,
  p_material_request_id uuid,
  p_purchase_order_id uuid,
  p_material_id uuid,
  p_request_item_id uuid,
  p_purchase_order_item_id uuid,
  p_budget_item_id uuid,
  p_quantity numeric,
  p_unit_cost numeric,
  p_notes text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_company_id uuid;
  v_transaction_id uuid := gen_random_uuid();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='MGL: authentication required';
  END IF;
  IF p_quantity IS NULL OR p_quantity<=0 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: inventory quantity must be positive';
  END IF;
  IF p_unit_cost IS NULL OR p_unit_cost<0 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: inventory unit cost cannot be negative';
  END IF;

  SELECT p.company_id INTO v_company_id
  FROM public.projects p
  WHERE p.id=p_project_id AND p.deleted_at IS NULL;

  IF v_company_id IS NULL OR NOT mgl_private.project_write(v_company_id,p_project_id,ARRAY['admin','pm','supervisor']::public.app_role[]) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: inventory manager access required';
  END IF;

  INSERT INTO public.inventory_transactions(
    id,company_id,project_id,number,movement_type,source_warehouse_id,target_warehouse_id,
    material_request_id,purchase_order_id,notes,created_by,updated_at,mutation_id
  ) VALUES(
    v_transaction_id,v_company_id,p_project_id,p_number,p_movement_type,p_source_warehouse_id,p_target_warehouse_id,
    p_material_request_id,p_purchase_order_id,coalesce(p_notes,''),auth.uid(),clock_timestamp(),gen_random_uuid()
  );

  INSERT INTO public.inventory_transaction_items(
    id,company_id,project_id,transaction_id,material_id,request_item_id,purchase_order_item_id,budget_item_id,
    quantity,unit_cost,notes,updated_at,mutation_id
  ) VALUES(
    gen_random_uuid(),v_company_id,p_project_id,v_transaction_id,p_material_id,p_request_item_id,p_purchase_order_item_id,p_budget_item_id,
    p_quantity,p_unit_cost,coalesce(p_notes,''),clock_timestamp(),gen_random_uuid()
  );

  RETURN mgl_private.post_inventory_transaction(v_transaction_id);
END;
$$;

CREATE FUNCTION public.create_inventory_movement(
  p_project_id uuid,
  p_number text,
  p_movement_type text,
  p_source_warehouse_id uuid,
  p_target_warehouse_id uuid,
  p_material_request_id uuid,
  p_purchase_order_id uuid,
  p_material_id uuid,
  p_request_item_id uuid,
  p_purchase_order_item_id uuid,
  p_budget_item_id uuid,
  p_quantity numeric,
  p_unit_cost numeric,
  p_notes text
) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT mgl_private.create_inventory_movement(
    p_project_id,p_number,p_movement_type,p_source_warehouse_id,p_target_warehouse_id,
    p_material_request_id,p_purchase_order_id,p_material_id,p_request_item_id,p_purchase_order_item_id,
    p_budget_item_id,p_quantity,p_unit_cost,p_notes
  );
$$;

REVOKE ALL ON FUNCTION public.create_inventory_movement(uuid,text,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,numeric,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_inventory_movement(uuid,text,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,numeric,numeric,text) TO authenticated;
REVOKE ALL ON FUNCTION mgl_private.create_inventory_movement(uuid,text,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,numeric,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION mgl_private.create_inventory_movement(uuid,text,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,numeric,numeric,text) TO authenticated;
