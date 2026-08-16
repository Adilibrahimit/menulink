-- 0081_order_guards.sql
--
-- Two server-side guards on new orders. Both mirror a client-side check added
-- in the same change; the client version is UX, this one is the boundary.
--
-- 1. MINIMUM ORDER. branch_service_areas.min_order has been read into the
--    customer's DeliveryContext since 0040 and then ignored, so a 12 ر.س
--    delivery order passed a 35 ر.س minimum. Live data today: فرع الملز = 35,
--    one عزيزية radius tier = 100.
--
-- 2. BRANCH OWNERSHIP. submit_order accepts a client-supplied branch_id and
--    never checks it belongs to the tenant (0057:51-55). Beyond the tenant
--    leak, next_order_number(branch_id) then advances THAT branch's
--    next_invoice_sequence — a gapless counter that ZATCA-adjacent bookkeeping
--    relies on. This matters more now that nearest-branch resolution makes
--    branch_id vary per order instead of always being the default.
--
-- Same trigger style as 0080: a BEFORE INSERT check rather than re-pasting the
-- 7 KB submit_order body, which has already been redefined nine times.

create or replace function public.orders_validate_branch_and_minimum()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_restaurant uuid;
  v_branch_active     boolean;
  v_min               numeric;
begin
  -- --- branch must belong to this restaurant, and be active ----------------
  if new.branch_id is not null then
    select b.restaurant_id, b.is_active
      into v_branch_restaurant, v_branch_active
      from public.restaurant_branches b
     where b.id = new.branch_id;

    if v_branch_restaurant is null then
      raise exception 'invalid_branch' using hint = 'branch_id does not exist';
    end if;
    if v_branch_restaurant <> new.restaurant_id then
      raise exception 'invalid_branch'
        using hint = 'branch_id belongs to a different restaurant';
    end if;
    if not coalesce(v_branch_active, false) then
      raise exception 'invalid_branch' using hint = 'branch is not active';
    end if;
  end if;

  -- --- delivery minimum ----------------------------------------------------
  -- Only for delivery, and only when a zone actually declares a minimum.
  -- Compared against the goods subtotal, NOT the total: charging the customer
  -- a delivery fee and then counting that fee toward the minimum would be
  -- circular. Matches what the cart shows.
  if new.order_type = 'delivery' and new.branch_id is not null then
    select max(sa.min_order)
      into v_min
      from public.branch_service_areas sa
     where sa.branch_id = new.branch_id
       and sa.is_active
       and sa.min_order is not null
       -- the cheapest qualifying tier is the one the customer was quoted, so
       -- take the SMALLEST minimum across active zones as the real floor
       and sa.min_order = (
         select min(sa2.min_order) from public.branch_service_areas sa2
          where sa2.branch_id = new.branch_id and sa2.is_active and sa2.min_order is not null
       );

    if v_min is not null and coalesce(new.subtotal, 0) < v_min then
      raise exception 'below_min_order'
        using hint = format('subtotal %s is under the branch minimum %s', new.subtotal, v_min);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_validate_guards on public.orders;
create trigger orders_validate_guards
  before insert on public.orders
  for each row execute function public.orders_validate_branch_and_minimum();

comment on function public.orders_validate_branch_and_minimum() is
  'Rejects orders whose branch_id belongs to another tenant / is inactive, and '
  'delivery orders under the branch''s smallest active zone minimum. Client '
  'mirrors both (cart-drawer / premium-checkout-flow); this is the boundary.';
