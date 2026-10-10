-- MGL Systems / Fase 8 - contexto de planificación en un solo round-trip.
CREATE OR REPLACE FUNCTION public.get_project_planning_context(p_project_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path=''
AS $$
  WITH active_baseline AS (
    SELECT b.*
    FROM public.schedule_baselines b
    WHERE b.project_id=p_project_id AND b.deleted_at IS NULL AND b.status='active'
    ORDER BY b.version_no DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'tasks',coalesce((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY nullif(t.wbs_code,''),t.position,t.title,t.id)
      FROM public.tasks t
      WHERE t.project_id=p_project_id AND t.deleted_at IS NULL
    ),'[]'::jsonb),
    'dependencies',coalesce((
      SELECT jsonb_agg(to_jsonb(d) ORDER BY d.created_at,d.id)
      FROM public.task_dependencies d
      WHERE d.project_id=p_project_id AND d.deleted_at IS NULL
    ),'[]'::jsonb),
    'baseline',(SELECT to_jsonb(b) FROM active_baseline b),
    'baseline_tasks',coalesce((
      SELECT jsonb_agg(to_jsonb(bt) ORDER BY nullif(bt.wbs_code,''),bt.title,bt.id)
      FROM public.schedule_baseline_tasks bt
      JOIN active_baseline b ON b.id=bt.baseline_id
      WHERE bt.project_id=p_project_id AND bt.deleted_at IS NULL
    ),'[]'::jsonb),
    'baseline_dependencies',coalesce((
      SELECT jsonb_agg(to_jsonb(bd) ORDER BY bd.created_at,bd.id)
      FROM public.schedule_baseline_dependencies bd
      JOIN active_baseline b ON b.id=bd.baseline_id
      WHERE bd.project_id=p_project_id AND bd.deleted_at IS NULL
    ),'[]'::jsonb),
    'progress_history',coalesce((
      SELECT jsonb_agg(x.row_data ORDER BY x.recorded_at,x.id)
      FROM (
        SELECT h.id,h.recorded_at,to_jsonb(h) AS row_data
        FROM public.task_progress_history h
        WHERE h.project_id=p_project_id AND h.deleted_at IS NULL
        ORDER BY h.recorded_at DESC,h.id DESC
        LIMIT 5000
      ) x
    ),'[]'::jsonb),
    'budget_items',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',i.id,'code',i.code,'description',i.description,'unit_code',i.unit_code,
        'quantity',i.quantity,'unit_price',i.unit_price,'budget_amount',i.budget_amount
      ) ORDER BY i.sort_order,i.code)
      FROM public.budget_items i
      JOIN public.project_budgets b
        ON b.company_id=i.company_id AND b.project_id=i.project_id AND b.id=i.budget_id
      WHERE i.project_id=p_project_id AND i.deleted_at IS NULL AND i.item_type='item'
        AND b.deleted_at IS NULL AND b.status='baseline'
    ),'[]'::jsonb),
    'members',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id',m.user_id,'full_name',p.full_name,'role',p.role
      ) ORDER BY p.full_name)
      FROM public.project_members m
      JOIN public.profiles p ON p.company_id=m.company_id AND p.user_id=m.user_id
      WHERE m.project_id=p_project_id AND m.deleted_at IS NULL AND p.deleted_at IS NULL
    ),'[]'::jsonb)
  )
  FROM public.projects p
  WHERE p.id=p_project_id AND p.deleted_at IS NULL
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_project_planning_context(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_project_planning_context(uuid) TO authenticated;
