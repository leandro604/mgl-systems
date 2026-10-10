-- Tarea 9 hardening: el cliente nunca obtiene UPDATE directo sobre notification_deliveries.
-- Un trigger privado ajusta la cola cuando cambian las preferencias del usuario.

CREATE OR REPLACE FUNCTION mgl_private.adjust_notification_deliveries_from_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
BEGIN
  UPDATE public.notification_deliveries d
  SET status='skipped',
      last_error='channel_disabled_by_user',
      updated_at=v_now,
      mutation_id=gen_random_uuid()
  WHERE d.company_id=NEW.company_id
    AND d.recipient_id=NEW.user_id
    AND d.deleted_at IS NULL
    AND d.status IN ('pending','scheduled')
    AND ((d.channel='email' AND NOT NEW.email_enabled) OR (d.channel='push' AND NOT NEW.push_enabled));

  IF NEW.quiet_hours_enabled THEN
    UPDATE public.notification_deliveries d
    SET scheduled_for=mgl_private.notification_delivery_at(d.company_id,d.recipient_id,d.scheduled_for),
        updated_at=v_now,
        mutation_id=gen_random_uuid()
    WHERE d.company_id=NEW.company_id
      AND d.recipient_id=NEW.user_id
      AND d.deleted_at IS NULL
      AND d.status IN ('pending','scheduled')
      AND d.channel IN ('email','push');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION mgl_private.adjust_notification_deliveries_from_preferences() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS user_preferences_adjust_notification_deliveries ON public.user_preferences;
CREATE TRIGGER user_preferences_adjust_notification_deliveries
AFTER INSERT OR UPDATE OF email_enabled,push_enabled,quiet_hours_enabled,quiet_start,quiet_end,timezone
ON public.user_preferences
FOR EACH ROW
EXECUTE FUNCTION mgl_private.adjust_notification_deliveries_from_preferences();

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

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.update_notification_preferences(boolean,boolean,boolean,time,time,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_notification_preferences(boolean,boolean,boolean,time,time,text) TO authenticated;
