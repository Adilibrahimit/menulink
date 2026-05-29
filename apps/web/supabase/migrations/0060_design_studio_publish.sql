-- ============================================================================
-- MenuLink · 0060_design_studio_publish
--
-- DS-2 support. Additive:
--   1. restaurant_design_profiles.updated_at + set_updated_at trigger.
--   2. publish_design_profile(uuid): atomic, advisory-locked, platform-admin
--      guarded publish that archives the tenant's current published profile and
--      promotes the target with a clean 1-based version number.
-- No data changes; no existing object altered destructively.
-- ============================================================================

-- 1. updated_at column + trigger (reuses public.set_updated_at from 0001)
alter table public.restaurant_design_profiles
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists restaurant_design_profiles_set_updated_at
  on public.restaurant_design_profiles;
create trigger restaurant_design_profiles_set_updated_at
  before update on public.restaurant_design_profiles
  for each row execute function public.set_updated_at();

-- 2. Atomic publish RPC
create or replace function public.publish_design_profile(p_profile_id uuid)
returns public.restaurant_design_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
  v_row public.restaurant_design_profiles;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  select restaurant_id into v_rid
    from public.restaurant_design_profiles where id = p_profile_id;
  if v_rid is null then
    raise exception 'profile % not found', p_profile_id;
  end if;

  -- serialize publishes for this tenant
  perform pg_advisory_xact_lock(hashtextextended(v_rid::text, 0));

  -- archive the currently-published profile (if different from the target)
  update public.restaurant_design_profiles
     set status = 'archived'
   where restaurant_id = v_rid
     and status = 'published'
     and id <> p_profile_id;

  -- publish the target with a clean 1-based version number
  update public.restaurant_design_profiles
     set status = 'published',
         published_at = now(),
         version_number = coalesce(
           (select max(version_number) from public.restaurant_design_profiles
             where restaurant_id = v_rid
               and status in ('published', 'archived')), 0) + 1
   where id = p_profile_id
   returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.publish_design_profile(uuid) to authenticated;
