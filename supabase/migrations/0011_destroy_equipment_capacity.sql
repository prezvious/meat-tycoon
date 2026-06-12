create or replace function public.destroy_equipment(p_equipment_item_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.private_current_user_id();
  active_jobs integer;
  current_qty integer;
  slot_count integer;
  remaining_slots integer;
begin
  perform public.initialize_player_save();

  select oe.quantity, ei.cooking_slot_count
  into current_qty, slot_count
  from public.owned_equipment oe
  join public.equipment_items ei on ei.id = oe.equipment_item_id
  where oe.user_id = v_user_id
    and oe.equipment_item_id = p_equipment_item_id
  for update of oe;

  if current_qty is null then
    raise exception 'Equipment is not owned';
  end if;

  select count(*)
  into active_jobs
  from public.cooking_jobs
  where user_id = v_user_id
    and equipment_item_id = p_equipment_item_id
    and cooking_completed = false;

  remaining_slots := greatest(0, current_qty - 1) * coalesce(slot_count, 1);

  if active_jobs > remaining_slots then
    raise exception 'Cannot destroy equipment; active cooking jobs exceed the capacity of remaining units';
  end if;

  if current_qty > 1 then
    update public.owned_equipment
    set quantity = quantity - 1
    where user_id = v_user_id
      and equipment_item_id = p_equipment_item_id;
  else
    delete from public.owned_equipment
    where user_id = v_user_id
      and equipment_item_id = p_equipment_item_id;
  end if;
end;
$$;

grant execute on function public.destroy_equipment(text) to authenticated;
