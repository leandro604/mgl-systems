CREATE INDEX IF NOT EXISTS activity_feed_actor_idx
  ON public.activity_feed(company_id, actor_id);
