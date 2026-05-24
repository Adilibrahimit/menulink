-- ============================================================================
-- MenuLink · 0028_auto_link_customer_rpc
--
-- When a Google-signed-in user visits a restaurant where they have no
-- customer record, but they DO have one on another restaurant, auto-create
-- a customer record for this restaurant with the same phone/name.
-- ============================================================================

begin;

create or replace function public.auto_link_customer(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_existing record;
  v_new_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  -- Already has a record on this restaurant?
  if exists (
    select 1 from customers
     where auth_user_id = v_uid
       and restaurant_id = p_restaurant_id
       and deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_exists');
  end if;

  -- Find an existing linked record on ANY restaurant
  select phone, name into v_existing
    from customers
   where auth_user_id = v_uid
     and deleted_at is null
     and phone not like 'deleted_%'
   limit 1;

  if v_existing.phone is null then
    return jsonb_build_object('ok', false, 'reason', 'no_source');
  end if;

  -- Create the customer record for this restaurant
  insert into customers (restaurant_id, phone, name, auth_user_id)
  values (p_restaurant_id, v_existing.phone, v_existing.name, v_uid)
  returning id into v_new_id;

  return jsonb_build_object('ok', true, 'customer_id', v_new_id);
end;
$$;

commit;
