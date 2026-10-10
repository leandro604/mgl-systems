-- MGL Systems · Tarea 9 · Notificaciones completas
-- Realtime + quiet hours + RPCs de usuario + cola segura para worker externo.

-- Realtime: solo tablas que la UI necesita observar en vivo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notification_deliveries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_deliveries;
  END IF;
END $$;

-- Ajusta una fecha de entrega para respetar las horas silenciosas del usuario.
CREATE OR REPLACE FUNCTION mgl_private.notification_delivery_at(
  p_company_id uuid,
  p_user_id uuid,
  p_desired_at timestamptz
) RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_enabled boolean := false;
  v_start time;
  v_end time;
  v_timezone text := 'America/Lima';
  v_local timestamp;
  v_resume_local timestamp;
BEGIN
  SELECT u.quiet_hours_enabled, u.quiet_start, u.quiet_end, u.timezone
    INTO v_enabled, v_start, v_end, v_timezone
  FROM public.user_preferences u
  WHERE u.company_id=p_company_id
    AND u.user_id=p_user_id
    AND u.deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND OR NOT coalesce(v_enabled,false) OR v_start IS NULL OR v_end IS NULL OR v_start=v_end THEN
    RETURN p_desired_at;
  END IF;

  v_local := p_desired_at AT TIME ZONE v_timezone;

  IF v_start < v_end THEN
    -- Ej. 13:00 → 15:00.
    IF v_local::time >= v_start AND v_local::time < v_end THEN
      v_resume_local := v_local::date + v_end;
    ELSE
      RETURN p_desired_at;
    END IF;
  ELSE
    -- Ventana nocturna que cruza medianoche. Ej. 22:00 → 07:00.
    IF v_local::time >= v_start THEN
      v_resume_local := (v_local::date + 1) + v_end;
    ELSIF v_local::time < v_end THEN
      v_resume_local := v_local::date + v_end;
    ELSE
      RETURN p_desired_at;
    END IF;
  END IF;

  RETURN v_resume_local AT TIME ZONE v_timezone;
EXCEPTION
  WHEN invalid_parameter_value THEN
    -- Una zona horaria inválida nunca debe impedir crear la notificación in-app.
    RETURN p_desired_at;
END;
$$;

REVOKE ALL ON FUNCTION mgl_private.notification_delivery_at(uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mgl_private.notification_delivery_at(uuid,uuid,timestamptz) TO service_role;

-- Fuente de verdad: in-app inmediata; email 5 min después; push inmediato,
-- ambos canales externos se desplazan al final de quiet hours cuando aplica.
CREATE OR REPLACE FUNCTION mgl_private.enqueue_notification(
  p_company_id uuid,p_project_id uuid,p_recipient_id uuid,p_actor_id uuid,p_kind text,p_title text,p_body text,
  p_entity_type text,p_entity_id uuid,p_action_url text,p_metadata jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_id uuid:=gen_random_uuid();
  v_email boolean:=true;
  v_push boolean:=false;
  v_email_at timestamptz;
  v_push_at timestamptz;
BEGIN
  IF p_recipient_id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.notifications(id,company_id,project_id,recipient_id,actor_id,kind,title,body,entity_type,entity_id,action_url,metadata)
  VALUES(v_id,p_company_id,p_project_id,p_recipient_id,p_actor_id,p_kind,p_title,coalesce(p_body,''),p_entity_type,p_entity_id,p_action_url,coalesce(p_metadata,'{}'::jsonb));

  INSERT INTO public.notification_deliveries(company_id,notification_id,recipient_id,channel,status,scheduled_for,sent_at)
  VALUES(p_company_id,v_id,p_recipient_id,'in_app','sent',clock_timestamp(),clock_timestamp());

  SELECT coalesce(u.email_enabled,true),coalesce(u.push_enabled,false)
    INTO v_email,v_push
  FROM public.user_preferences u
  WHERE u.company_id=p_company_id AND u.user_id=p_recipient_id AND u.deleted_at IS NULL;

  IF NOT FOUND THEN
    v_email := true;
    v_push := false;
  END IF;

  IF v_email THEN
    v_email_at := mgl_private.notification_delivery_at(p_company_id,p_recipient_id,clock_timestamp()+interval '5 minutes');
    INSERT INTO public.notification_deliveries(company_id,notification_id,recipient_id,channel,status,scheduled_for)
    VALUES(p_company_id,v_id,p_recipient_id,'email','scheduled',v_email_at);
  END IF;

  IF v_push THEN
    v_push_at := mgl_private.notification_delivery_at(p_company_id,p_recipient_id,clock_timestamp());
    INSERT INTO public.notification_deliveries(company_id,notification_id,recipient_id,channel,status,scheduled_for)
    VALUES(p_company_id,v_id,p_recipient_id,'push','scheduled',v_push_at);
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION mgl_private.enqueue_notification(uuid,uuid,uuid,uuid,text,text,text,text,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mgl_private.enqueue_notification(uuid,uuid,uuid,uuid,text,text,text,text,uuid,text,jsonb) TO service_role;

-- Corrige el deep-link de tareas para el Kanban de Tarea 6.
CREATE OR REPLACE FUNCTION mgl_private.notify_task_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id) THEN
    PERFORM mgl_private.enqueue_notification(
      NEW.company_id, NEW.project_id, NEW.assignee_id, auth.uid(),
      'task_assigned', 'Nueva tarea asignada', NEW.title,
      'task', NEW.id,
      '/app/projects/'||NEW.project_id||'/tasks?focus='||NEW.id,
      jsonb_build_object('stage_id',NEW.stage_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION mgl_private.notify_task_assignment() FROM PUBLIC,anon,authenticated;

-- Lectura / no lectura. RLS sigue siendo la barrera principal.
CREATE OR REPLACE FUNCTION public.set_notification_read(
  p_notification_id uuid,
  p_read boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $$
DECLARE
  v_row public.notifications;
  v_now timestamptz := clock_timestamp();
BEGIN
  UPDATE public.notifications n
  SET read_at = CASE WHEN p_read THEN coalesce(n.read_at,v_now) ELSE NULL END,
      updated_at = v_now,
      mutation_id = gen_random_uuid()
  WHERE n.id=p_notification_id
    AND n.recipient_id=auth.uid()
    AND n.deleted_at IS NULL
  RETURNING n.* INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: notification unavailable';
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.set_notification_read(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_notification_read(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $$
DECLARE
  v_count integer;
  v_now timestamptz := clock_timestamp();
BEGIN
  UPDATE public.notifications n
  SET read_at=v_now,
      updated_at=v_now,
      mutation_id=gen_random_uuid()
  WHERE n.recipient_id=auth.uid()
    AND n.deleted_at IS NULL
    AND n.read_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

-- Preferencias de notificación. in_app_enabled permanece true por constraint.
CREATE OR REPLACE FUNCTION public.update_notification_preferences(
  p_email_enabled boolean,
  p_push_enabled boolean,
  p_quiet_hours_enabled boolean,
  p_quiet_start time,
  p_quiet_end time,
  p_timezone text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $$
DECLARE
  v_profile public.profiles;
  v_row public.user_preferences;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: authentication required';
  END IF;

  SELECT p.* INTO v_profile
  FROM public.profiles p
  WHERE p.user_id=auth.uid() AND p.deleted_at IS NULL
  LIMIT 1;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: active profile required';
  END IF;

  IF p_quiet_hours_enabled AND (p_quiet_start IS NULL OR p_quiet_end IS NULL OR p_quiet_start=p_quiet_end) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: quiet hours require distinct start and end times';
  END IF;

  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_timezone) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: invalid timezone';
  END IF;

  INSERT INTO public.user_preferences(
    company_id,user_id,in_app_enabled,email_enabled,push_enabled,quiet_hours_enabled,quiet_start,quiet_end,timezone,
    updated_at,mutation_id
  ) VALUES(
    v_profile.company_id,v_profile.user_id,true,p_email_enabled,p_push_enabled,p_quiet_hours_enabled,
    CASE WHEN p_quiet_hours_enabled THEN p_quiet_start ELSE NULL END,
    CASE WHEN p_quiet_hours_enabled THEN p_quiet_end ELSE NULL END,
    p_timezone,v_now,gen_random_uuid()
  )
  ON CONFLICT(company_id,user_id) DO UPDATE SET
    email_enabled=excluded.email_enabled,
    push_enabled=excluded.push_enabled,
    quiet_hours_enabled=excluded.quiet_hours_enabled,
    quiet_start=excluded.quiet_start,
    quiet_end=excluded.quiet_end,
    timezone=excluded.timezone,
    updated_at=excluded.updated_at,
    mutation_id=excluded.mutation_id
  RETURNING * INTO v_row;

  -- Preferencias nuevas también afectan entregas externas todavía no procesadas.
  UPDATE public.notification_deliveries d
  SET status='skipped',
      last_error='channel_disabled_by_user',
      updated_at=v_now,
      mutation_id=gen_random_uuid()
  WHERE d.company_id=v_profile.company_id
    AND d.recipient_id=v_profile.user_id
    AND d.deleted_at IS NULL
    AND d.status IN ('pending','scheduled')
    AND ((d.channel='email' AND NOT p_email_enabled) OR (d.channel='push' AND NOT p_push_enabled));

  IF p_quiet_hours_enabled THEN
    UPDATE public.notification_deliveries d
    SET scheduled_for=mgl_private.notification_delivery_at(d.company_id,d.recipient_id,d.scheduled_for),
        updated_at=v_now,
        mutation_id=gen_random_uuid()
    WHERE d.company_id=v_profile.company_id
      AND d.recipient_id=v_profile.user_id
      AND d.deleted_at IS NULL
      AND d.status IN ('pending','scheduled')
      AND d.channel IN ('email','push');
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.update_notification_preferences(boolean,boolean,boolean,time,time,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_notification_preferences(boolean,boolean,boolean,time,time,text) TO authenticated;

-- Suscripción Web Push del navegador actual.
CREATE OR REPLACE FUNCTION public.upsert_push_subscription(
  p_company_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth_key text,
  p_device_id text,
  p_user_agent text,
  p_enabled boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $$
DECLARE
  v_row public.push_subscriptions;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF auth.uid() IS NULL OR mgl_private.company_role(p_company_id) IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: company membership required';
  END IF;

  INSERT INTO public.push_subscriptions(
    company_id,user_id,endpoint,p256dh,auth_key,device_id,user_agent,enabled,last_seen_at,updated_at,mutation_id
  ) VALUES(
    p_company_id,auth.uid(),trim(p_endpoint),p_p256dh,p_auth_key,coalesce(p_device_id,''),coalesce(p_user_agent,''),p_enabled,v_now,v_now,gen_random_uuid()
  )
  ON CONFLICT(company_id,user_id,endpoint) DO UPDATE SET
    p256dh=excluded.p256dh,
    auth_key=excluded.auth_key,
    device_id=excluded.device_id,
    user_agent=excluded.user_agent,
    enabled=excluded.enabled,
    last_seen_at=excluded.last_seen_at,
    updated_at=excluded.updated_at,
    mutation_id=excluded.mutation_id
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_push_subscription(uuid,text,text,text,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.upsert_push_subscription(uuid,text,text,text,text,text,boolean) TO authenticated;

-- Worker de delivery: claim atómico con lease de 2 minutos para evitar duplicados.
CREATE OR REPLACE FUNCTION public.claim_notification_deliveries(p_limit integer DEFAULT 25)
RETURNS SETOF public.notification_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF current_user NOT IN ('postgres','service_role') THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: service role required';
  END IF;

  RETURN QUERY
  WITH due AS (
    SELECT d.id
    FROM public.notification_deliveries d
    JOIN public.notifications n
      ON n.company_id=d.company_id AND n.id=d.notification_id
    WHERE d.deleted_at IS NULL
      AND n.deleted_at IS NULL
      AND n.read_at IS NULL
      AND d.channel IN ('email','push')
      AND d.status IN ('pending','scheduled')
      AND d.scheduled_for <= clock_timestamp()
    ORDER BY d.scheduled_for,d.id
    FOR UPDATE OF d SKIP LOCKED
    LIMIT greatest(1,least(coalesce(p_limit,25),100))
  )
  UPDATE public.notification_deliveries d
  SET attempted_at=clock_timestamp(),
      attempt_count=d.attempt_count+1,
      scheduled_for=clock_timestamp()+interval '2 minutes',
      updated_at=clock_timestamp(),
      mutation_id=gen_random_uuid()
  FROM due
  WHERE d.id=due.id
  RETURNING d.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_deliveries(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_deliveries(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_notification_delivery(
  p_delivery_id uuid,
  p_status public.notification_delivery_status,
  p_provider_message_id text DEFAULT NULL,
  p_error text DEFAULT NULL,
  p_retry_after_seconds integer DEFAULT NULL
) RETURNS public.notification_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_row public.notification_deliveries;
  v_status public.notification_delivery_status;
BEGIN
  IF current_user NOT IN ('postgres','service_role') THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: service role required';
  END IF;

  IF p_retry_after_seconds IS NOT NULL THEN
    v_status := 'scheduled';
  ELSIF p_status NOT IN ('sent','skipped','failed') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: invalid terminal delivery status';
  ELSE
    v_status := p_status;
  END IF;

  UPDATE public.notification_deliveries d
  SET status=v_status,
      scheduled_for=CASE WHEN p_retry_after_seconds IS NOT NULL
        THEN clock_timestamp()+make_interval(secs=>greatest(30,least(p_retry_after_seconds,3600)))
        ELSE d.scheduled_for END,
      sent_at=CASE WHEN v_status='sent' THEN clock_timestamp() ELSE d.sent_at END,
      provider_message_id=coalesce(p_provider_message_id,d.provider_message_id),
      last_error=p_error,
      updated_at=clock_timestamp(),
      mutation_id=gen_random_uuid()
  WHERE d.id=p_delivery_id
  RETURNING d.* INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='MGL: delivery not found';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.finish_notification_delivery(uuid,public.notification_delivery_status,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_notification_delivery(uuid,public.notification_delivery_status,text,text,integer) TO service_role;
