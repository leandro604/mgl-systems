create or replace function public.get_workspace_context()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', p.user_id,
    'email', coalesce(auth.jwt() ->> 'email', ''),
    'profile', jsonb_build_object(
      'id', p.id,
      'company_id', p.company_id,
      'user_id', p.user_id,
      'full_name', p.full_name,
      'role', p.role,
      'deleted_at', p.deleted_at
    ),
    'company', jsonb_build_object(
      'id', c.id,
      'legal_name', c.legal_name,
      'ruc', c.ruc,
      'timezone', c.timezone,
      'currency', c.currency,
      'deleted_at', c.deleted_at
    ),
    'projects', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', pr.id,
          'company_id', pr.company_id,
          'code', pr.code,
          'name', pr.name,
          'description', pr.description,
          'status', pr.status,
          'starts_on', pr.starts_on,
          'ends_on', pr.ends_on,
          'created_by', pr.created_by,
          'created_at', pr.created_at,
          'updated_at', pr.updated_at,
          'server_updated_at', pr.server_updated_at
        )
        order by pr.name
      )
      from public.projects pr
      where pr.company_id = p.company_id
        and pr.deleted_at is null
    ), '[]'::jsonb)
  )
  from public.profiles p
  join public.companies c
    on c.id = p.company_id
   and c.deleted_at is null
  where p.user_id = auth.uid()
    and p.deleted_at is null
  limit 1
$$;

revoke all on function public.get_workspace_context() from public, anon;
grant execute on function public.get_workspace_context() to authenticated;
