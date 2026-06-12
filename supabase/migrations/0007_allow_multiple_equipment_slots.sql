-- Add quantity column to owned_equipment
alter table public.owned_equipment add column if not exists quantity integer not null default 1;

-- Update buy_equipment to increment quantity on conflict
create or replace function public.buy_equipment(p_equipment_item_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.private_current_user_id();
  item record;
begin
  perform public.initialize_player_save();
  select * into item from public.equipment_items where id = p_equipment_item_id and enabled = true;
  if item is null then
    raise exception 'Unknown equipment item';
  end if;

  update public.player_saves
  set balance = balance - item.purchase_price,
      lifetime_spent = lifetime_spent + item.purchase_price,
      last_saved_at = now()
  where user_id = v_user_id and balance >= item.purchase_price;

  if not found then
    raise exception 'Insufficient balance';
  end if;

  insert into public.owned_equipment (user_id, equipment_item_id, active, quantity)
  values (v_user_id, item.id, true, 1)
  on conflict (user_id, equipment_item_id) do update
  set quantity = owned_equipment.quantity + 1;

  update public.lifetime_statistics
  set total_money_spent_on_equipment = total_money_spent_on_equipment + item.purchase_price,
      updated_at = now()
  where user_id = v_user_id;
end;
$$;

-- Update destroy_equipment to decrement quantity or delete if 1
create or replace function public.destroy_equipment(p_equipment_item_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.private_current_user_id();
  active_jobs integer;
  slot_count integer;
  current_qty integer;
begin
  perform public.initialize_player_save();

  select count(*) into active_jobs
  from public.cooking_jobs
  where user_id = v_user_id
    and equipment_item_id = p_equipment_item_id
    and cooking_completed = false;

  select oe.quantity, ei.cooking_slot_count into current_qty, slot_count
  from public.owned_equipment oe
  join public.equipment_items ei on ei.id = oe.equipment_item_id
  where oe.user_id = v_user_id
    and oe.equipment_item_id = p_equipment_item_id;

  if active_jobs > (coalesce(current_qty, 1) - 1) * coalesce(slot_count, 1) then
    raise exception 'Cannot destroy equipment; active cooking jobs exceed the capacity of remaining units';
  end if;

  update public.owned_equipment
  set quantity = quantity - 1
  where user_id = v_user_id
    and equipment_item_id = p_equipment_item_id
    and quantity > 1;

  if not found then
    delete from public.owned_equipment
    where user_id = v_user_id
      and equipment_item_id = p_equipment_item_id;
  end if;
end;
$$;

-- Update start_cooking to count slots based on total quantity
create or replace function public.start_cooking(
  p_meat_instance_id uuid,
  p_equipment_item_id text,
  p_target_cooking_state text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.private_current_user_id();
  meat record;
  equipment record;
  occupied_count integer;
  total_slots integer;
  slot_index integer;
  duration_seconds integer;
  job_id uuid;
begin
  perform public.initialize_player_save();
  perform public.resolve_time_progress();

  select * into meat
  from public.meat_instances
  where id = p_meat_instance_id
    and user_id = v_user_id
    and sold_at is null
  for update;

  if meat is null then
    raise exception 'Unknown meat instance';
  end if;
  if meat.current_cooking_state <> 'raw' then
    raise exception 'Only raw meat can start cooking';
  end if;
  if p_target_cooking_state not in ('cooked', 'well_cooked', 'perfectly_cooked', 'overcooked') then
    raise exception 'Invalid cooking target';
  end if;

  select ei.*, oe.quantity into equipment
  from public.equipment_items ei
  join public.owned_equipment oe on oe.equipment_item_id = ei.id
  where oe.user_id = v_user_id
    and oe.active = true
    and ei.id = p_equipment_item_id;

  if equipment is null then
    raise exception 'Equipment is not owned';
  end if;

  select count(*) into occupied_count
  from public.cooking_jobs
  where user_id = v_user_id
    and equipment_item_id = p_equipment_item_id
    and cooking_completed = false;

  total_slots := equipment.cooking_slot_count * equipment.quantity;

  if occupied_count >= total_slots then
    raise exception 'No equipment slot available';
  end if;

  slot_index := occupied_count;
  duration_seconds := greatest(
    60,
    round(90 * least(8, sqrt(greatest(meat.spawned_weight, 1.00))) *
      case p_target_cooking_state
        when 'cooked' then 1
        when 'well_cooked' then 1.25
        when 'perfectly_cooked' then 1.45
        when 'overcooked' then 1.8
        else 1
      end
    )::integer
  );

  insert into public.cooking_jobs (
    user_id,
    meat_instance_id,
    equipment_item_id,
    equipment_slot_index,
    cooking_started_at,
    cooking_target_end_at,
    cooking_duration_seconds,
    target_cooking_state,
    cooking_completed,
    auto_stop_at_target
  )
  values (
    v_user_id,
    meat.id,
    equipment.id,
    slot_index,
    now(),
    now() + make_interval(secs => duration_seconds),
    duration_seconds,
    p_target_cooking_state,
    false,
    true
  )
  returning id into job_id;

  update public.meat_instances
  set current_cooking_state = 'cooking',
      selected_equipment_item_id = equipment.id
  where id = meat.id;

  return job_id;
end;
$$;
