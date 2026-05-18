-- ============================================================================
-- MenuLink · 0006_ops_helpers
--
-- Small RPCs that the /ops dashboard needs to display joined data from
-- auth.users without giving ops direct SELECT access to the auth schema.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- get_tenant_owners(p_restaurant_id uuid)
--   Returns the list of users linked to a restaurant + their emails.
--   Only callable by platform_admins (enforced inside the function).
-- ---------------------------------------------------------------------------

create or replace function public.get_tenant_owners(p_restaurant_id uuid)
returns table (
  user_id    uuid,
  email      text,
  role       text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public, auth
as $$
begin
  if (auth.jwt() ->> 'role') is distinct from 'platform_admin' then
    raise exception 'access denied';
  end if;

  return query
  select
    ro.user_id,
    u.email::text,
    ro.role,
    ro.created_at,
    u.last_sign_in_at
  from public.restaurant_owners ro
  join auth.users u on u.id = ro.user_id
  where ro.restaurant_id = p_restaurant_id
  order by ro.created_at;
end;
$$;

revoke all on function public.get_tenant_owners(uuid) from public;
grant execute on function public.get_tenant_owners(uuid) to authenticated;
