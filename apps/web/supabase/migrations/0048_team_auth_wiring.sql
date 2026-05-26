-- 0048_team_auth_wiring.sql
-- Wire up JWT claims for restaurant_admins so team members can log in.
-- Priority: platform_admin > restaurant_owner > restaurant_admin.

-- 1. Replace refresh_user_app_metadata to also check restaurant_admins
create or replace function public.refresh_user_app_metadata(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_platform_admin boolean;
  v_owner_rid         uuid;
  v_admin_rid         uuid;
  v_admin_role        text;
  v_meta              jsonb;
begin
  select exists (select 1 from public.platform_admins where user_id = p_user_id)
    into v_is_platform_admin;

  select restaurant_id into v_owner_rid
    from public.restaurant_owners
   where user_id = p_user_id
   order by created_at
   limit 1;

  select restaurant_id, role into v_admin_rid, v_admin_role
    from public.restaurant_admins
   where user_id = p_user_id
     and is_active = true
   order by created_at
   limit 1;

  v_meta := coalesce(
    (select raw_app_meta_data from auth.users where id = p_user_id),
    '{}'::jsonb
  );

  if v_is_platform_admin then
    v_meta := v_meta || jsonb_build_object('role', 'platform_admin');
    v_meta := v_meta - 'restaurant_id' - 'team_role';
  elsif v_owner_rid is not null then
    v_meta := v_meta || jsonb_build_object(
      'role', 'restaurant_owner',
      'restaurant_id', v_owner_rid::text
    );
    v_meta := v_meta - 'team_role';
  elsif v_admin_rid is not null then
    v_meta := v_meta || jsonb_build_object(
      'role', 'restaurant_admin',
      'restaurant_id', v_admin_rid::text,
      'team_role', v_admin_role
    );
  else
    v_meta := v_meta - 'role' - 'restaurant_id' - 'team_role';
  end if;

  update auth.users
     set raw_app_meta_data = v_meta
   where id = p_user_id;
end;
$$;

-- 2. Add trigger on restaurant_admins (idempotent)
drop trigger if exists restaurant_admins_refresh_meta on public.restaurant_admins;

create trigger restaurant_admins_refresh_meta
  after insert or update or delete on public.restaurant_admins
  for each row execute function public.refresh_app_metadata_on_change();

-- 3. Backfill: refresh claims for all existing team members
do $$
begin
  perform public.refresh_user_app_metadata(user_id)
    from (select distinct user_id from public.restaurant_admins where is_active = true) t;
end;
$$;
