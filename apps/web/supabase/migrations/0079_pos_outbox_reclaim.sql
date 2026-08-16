-- 0079_pos_outbox_reclaim.sql
--
-- Two holes in the Bridge App's outbox loop, both found while preparing the
-- rzrz-bukhari go-live.
--
-- 1. STRANDED CLAIMS. pos_outbox_claim (0009:230) flips a row pending->claimed,
--    the bridge calls InsertInvoice, then marks it synced. If the bridge dies
--    or restarts between those two steps the row stays 'claimed' FOREVER:
--    pos_outbox_claim only ever selects 'pending', nothing else touches the
--    row, and `attempts` stays 0 so no retry cap notices. The POS has the held
--    bill, MenuLink believes it was never sent, and nobody is alerted. That is
--    a silently lost order, not a duplicate.
--
-- 2. RESTART FLOOD. A bridge that comes back after hours of downtime would
--    claim the whole backlog at once and inject a night of orders into the
--    kitchen. (Seen for real: 23 rows had been queuing on rzrz-bukhari since
--    2026-05-23 because no bridge was running.)
--
-- Retrying a reclaimed row is only safe because the adapter dedups before it
-- inserts (dbo.MenuLinkInvoiceMap + the InvoiceNotes_A tag precheck), so a
-- second attempt finds the existing POS invoice instead of creating another.
-- Do not enable reclaiming without that.

create or replace function public.pos_outbox_reclaim_stale(
  p_restaurant_id         uuid,
  p_claimed_after_minutes int default 10,
  p_max_age_minutes       int default 120
)
returns table (reclaimed int, expired int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reclaimed int := 0;
  v_expired   int := 0;
begin
  -- (a) claimed too long ago -> back to pending so the loop retries it.
  with revived as (
    update public.pos_outbox
       set status     = 'pending',
           claimed_by = null,
           claimed_at = null,
           last_error = 'reclaimed: claimed at ' || to_char(claimed_at, 'YYYY-MM-DD HH24:MI:SSOF')
                        || ' but never completed',
           updated_at = now()
     where restaurant_id = p_restaurant_id
       and status = 'claimed'
       and claimed_at < now() - make_interval(mins => p_claimed_after_minutes)
    returning 1
  )
  select count(*) into v_reclaimed from revived;

  -- (b) too old to serve -> park as failed. Runs AFTER (a) so a row that was
  --     stranded for days is expired here rather than re-injected.
  with aged as (
    update public.pos_outbox
       set status     = 'failed',
           claimed_by = null,
           claimed_at = null,
           last_error = 'stale: order created ' || to_char(created_at, 'YYYY-MM-DD HH24:MI')
                        || ', older than ' || p_max_age_minutes || ' minutes — not injected',
           updated_at = now()
     where restaurant_id = p_restaurant_id
       and status = 'pending'
       and created_at < now() - make_interval(mins => p_max_age_minutes)
    returning 1
  )
  select count(*) into v_expired from aged;

  return query select v_reclaimed, v_expired;
end;
$$;

-- Same grant shape as the other three bridge RPCs after 0071: service_role
-- only. Do NOT add an auth.uid() check — service_role has none and would be
-- wrongly rejected (0071 documents this).
revoke all on function public.pos_outbox_reclaim_stale(uuid, int, int) from public, anon, authenticated;
grant execute on function public.pos_outbox_reclaim_stale(uuid, int, int) to service_role;

comment on function public.pos_outbox_reclaim_stale(uuid, int, int) is
  'Bridge App calls this before each claim cycle. (a) returns rows stuck in '
  '"claimed" past p_claimed_after_minutes to "pending" so they retry — safe '
  'only because the POS adapter dedups on dbo.MenuLinkInvoiceMap. (b) parks '
  '"pending" rows older than p_max_age_minutes as "failed" so a restart after '
  'downtime cannot flood the kitchen with stale orders.';
