-- MGL Systems · Tarea 9 · EJEMPLO DE CONFIGURACIÓN (NO es migración)
-- Ejecutar solo después de guardar secretos reales en Supabase Vault.
-- La documentación oficial de Supabase recomienda Vault + pg_cron + pg_net.

-- 1) Guardar secretos una sola vez (reemplazar valores):
-- select vault.create_secret('https://PROJECT_REF.supabase.co', 'mgl_project_url');
-- select vault.create_secret('PUBLISHABLE_OR_LEGACY_ANON_KEY', 'mgl_publishable_key');
-- select vault.create_secret('UN_TOKEN_ALEATORIO_LARGO', 'mgl_notification_worker_token');

-- 2) Programar el worker cada minuto. Si ya existe el mismo nombre, cron.schedule lo reemplaza.
select cron.schedule(
  'mgl-process-notification-deliveries',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='mgl_project_url')
      || '/functions/v1/process-notification-deliveries',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name='mgl_publishable_key'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='mgl_publishable_key'),
      'x-mgl-worker-token', (select decrypted_secret from vault.decrypted_secrets where name='mgl_notification_worker_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  ) as request_id;
  $$
);

-- 3) Verificar el job:
-- select jobid, jobname, schedule, active from cron.job where jobname='mgl-process-notification-deliveries';
