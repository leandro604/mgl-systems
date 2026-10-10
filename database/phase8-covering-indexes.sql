-- MGL Systems / Fase 8 - índices de cobertura detectados por Database Advisor.
CREATE INDEX IF NOT EXISTS schedule_baselines_creator_idx
  ON public.schedule_baselines(company_id,created_by);
