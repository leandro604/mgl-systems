-- Billing events are a server-only webhook audit inbox.
DROP POLICY IF EXISTS billing_events_client_deny ON public.billing_events;
CREATE POLICY billing_events_client_deny
  ON public.billing_events
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
