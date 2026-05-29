-- ============================================================================
-- MenuLink · 0065_resolve_qr_link
--
-- DS-4-1: resolve a dynamic QR short-link and record a scan, for the public
-- /q/{code} route. SECURITY DEFINER (the route is anonymous; qr_links and
-- qr_scan_events are RLS ops/owner-only). Tracking is best-effort and never
-- blocks the redirect. Additive; get_public_menu and existing QR untouched.
-- ============================================================================

create or replace function public.resolve_qr_link(
  p_code text,
  p_user_agent text default null,
  p_referrer text default null,
  p_source_type text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_rid uuid;
  v_dest text;
  v_src text;
begin
  select id, restaurant_id, destination_url
    into v_id, v_rid, v_dest
  from public.qr_links
  where code = p_code and is_active = true
  limit 1;

  if v_id is null then
    return null;
  end if;

  v_src := case
    when p_source_type in ('table', 'poster', 'sticker', 'offer', 'category', 'item')
    then p_source_type else 'unknown'
  end;

  begin
    insert into public.qr_scan_events (restaurant_id, qr_link_id, user_agent, referrer, source_type)
    values (v_rid, v_id, left(p_user_agent, 500), left(p_referrer, 500), v_src);
  exception when others then
    null; -- scan tracking is best-effort; never block the redirect
  end;

  return v_dest;
end;
$$;

grant execute on function public.resolve_qr_link(text, text, text, text) to anon, authenticated;
