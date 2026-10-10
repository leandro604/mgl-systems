-- MGL Systems / Fase 7 - índices de cobertura para FKs detectadas por advisors.
create index if not exists material_request_items_material_fk_idx
  on public.material_request_items(company_id,material_id);
create index if not exists inventory_transaction_items_material_fk_idx
  on public.inventory_transaction_items(company_id,material_id);
create index if not exists inventory_transaction_items_po_item_fk_idx
  on public.inventory_transaction_items(company_id,purchase_order_item_id)
  where purchase_order_item_id is not null;
