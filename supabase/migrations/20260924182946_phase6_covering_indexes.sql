create index if not exists project_budgets_creator_idx
  on public.project_budgets(company_id,created_by);
create index if not exists progress_records_creator_idx
  on public.progress_records(company_id,created_by);
create index if not exists valuations_creator_idx
  on public.valuations(company_id,created_by);
