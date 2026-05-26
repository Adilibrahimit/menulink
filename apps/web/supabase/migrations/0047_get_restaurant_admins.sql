-- ============================================================================
-- MenuLink · 0047_get_restaurant_admins
--
-- RPC for the /admin/team page. Returns admins + their emails + branch access.
-- Callable by restaurant owners (mirrors 0006 pattern but scoped to owners).
-- ============================================================================

create or replace function public.get_restaurant_admins(p_restaurant_id uuid)
returns table (
  admin_id    uuid,
  user_id     uuid,
  email       text,
  role        text,
  is_active   boolean,
  created_at  timestamptz,
  branch_ids  uuid[]
)
language plpgsql
security definer
stable
set search_path = public, auth
as $$
begin
  if not public.owns_restaurant(p_restaurant_id)
     and not public.is_platform_admin() then
    raise exception 'access denied';
  end if;

  return query
  select
    ra.id            as admin_id,
    ra.user_id,
    u.email::text,
    ra.role,
    ra.is_active,
    ra.created_at,
    coalesce(
      array_agg(ba.branch_id) filter (where ba.branch_id is not null),
      '{}'::uuid[]
    ) as branch_ids
  from public.restaurant_admins ra
  join auth.users u on u.id = ra.user_id
  left join public.restaurant_admin_branch_access ba on ba.admin_id = ra.id
  where ra.restaurant_id = p_restaurant_id
  group by ra.id, ra.user_id, u.email, ra.role, ra.is_active, ra.created_at
  order by ra.created_at;
end;
$$;

revoke all on function public.get_restaurant_admins(uuid) from public;
grant execute on function public.get_restaurant_admins(uuid) to authenticated;
