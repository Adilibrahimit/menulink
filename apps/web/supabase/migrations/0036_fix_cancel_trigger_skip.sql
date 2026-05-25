-- 0036: Fix double-insert bug — trigger should skip cancellations
-- because the admin frontend inserts the event manually with reason details.

create or replace function public.fn_log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.status is distinct from NEW.status and NEW.status <> 'cancelled' then
    insert into public.order_events (
      order_id, event_type, old_status, new_status, actor_type, actor_id
    ) values (
      NEW.id,
      'status_change',
      OLD.status,
      NEW.status,
      'restaurant',
      coalesce(auth.uid()::text, 'system')
    );
  end if;
  return NEW;
end;
$$;
