-- MGL Systems — remote migration already applied to project vscwajxzjnqlcdulfqzl.
-- Adds covering indexes for composite foreign keys identified by Supabase Database Advisors.
create index if not exists purchase_order_items_company_project_order_idx
  on public.purchase_order_items(company_id, project_id, purchase_order_id);

create index if not exists invoice_items_company_project_invoice_idx
  on public.invoice_items(company_id, project_id, invoice_id);
