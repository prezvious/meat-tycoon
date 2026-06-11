alter table public.meat_instances
  alter column spawned_weight type numeric(60, 2) using round(spawned_weight, 2);

update public.weight_profiles
set
  body_min_kg = normalized.body_min_kg,
  body_max_kg = normalized.body_max_kg,
  large_threshold_kg = round(normalized.body_min_kg + ((normalized.body_max_kg - normalized.body_min_kg) * 0.5), 2),
  heavy_threshold_kg = round(normalized.body_min_kg + ((normalized.body_max_kg - normalized.body_min_kg) * 0.8), 2),
  massive_threshold_kg = round(normalized.body_min_kg + ((normalized.body_max_kg - normalized.body_min_kg) * 0.95), 2),
  tail_anchor_kg = greatest(1.00, weight_profiles.tail_anchor_kg)
from (
  select
    id,
    greatest(1.00, body_min_kg) as body_min_kg,
    case
      when body_max_kg <= 1.00 then 3.00
      else greatest(body_max_kg, greatest(1.00, body_min_kg) + 0.01)
    end as body_max_kg
  from public.weight_profiles
) as normalized
where weight_profiles.id = normalized.id;

create or replace function public.private_weight_rarity_label(p_weight numeric)
returns text
language sql
immutable
as $$
  select case
    when p_weight >= 100000000 then 'impossible'
    when p_weight >= 1000000 then 'absurd'
    when p_weight >= 100000 then 'giant'
    when p_weight >= 10000 then 'huge'
    when p_weight >= 1000 then 'massive'
    when p_weight >= 250 then 'heavy'
    when p_weight >= 50 then 'large'
    when p_weight >= 10 then 'normal'
    when p_weight >= 2 then 'small'
    when p_weight >= 1 then 'tiny'
    else 'invalid'
  end;
$$;

create or replace function public.private_is_saleable_cooked_state(p_state text)
returns boolean
language sql
immutable
as $$
  select p_state in ('cooked', 'well_cooked', 'perfectly_cooked');
$$;

create or replace function public.private_cooked_profit_floor_multiplier(p_state text)
returns numeric
language sql
immutable
as $$
  select case p_state
    when 'cooked' then 1.05
    when 'well_cooked' then 1.10
    when 'perfectly_cooked' then 1.20
    else 0
  end;
$$;

create or replace function public.private_roll_weight(p_profile_id text)
returns table(spawned_weight numeric, rarity_result text)
language plpgsql
security definer
set search_path = public
as $$
declare
  profile record;
  body_min numeric;
  body_max numeric;
  body_roll numeric;
  roll_weight numeric;
begin
  select * into profile from public.weight_profiles where id = p_profile_id and enabled = true;
  if profile is null then
    raise exception 'Missing weight profile %', p_profile_id;
  end if;

  body_min := greatest(1.00, profile.body_min_kg);
  body_max := case
    when profile.body_max_kg <= 1.00 then 3.00
    else greatest(profile.body_max_kg, body_min + 0.01)
  end;

  body_roll :=
    body_min +
    ((body_max - body_min) * power(random(), greatest(profile.body_shape, 0.01)));

  if random() < greatest(0, profile.tail_chance) then
    roll_weight :=
      greatest(1.00, profile.tail_anchor_kg) /
      power(greatest(random(), 0.000001), 1 / greatest(profile.tail_alpha, 1.01));
  else
    roll_weight := body_roll;
  end if;

  spawned_weight := round(greatest(1.00, roll_weight), 2);
  rarity_result := public.private_weight_rarity_label(spawned_weight);
  return next;
end;
$$;

create or replace function public.private_calculate_sale_value(p_meat_instance_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  meat record;
  equipment_multiplier numeric := 1;
  seasoning_multiplier numeric := 1;
  stacked_seasoning numeric := 1;
  sale_modifier numeric := 1;
  base_value numeric;
  sale_floor numeric := 0;
  final_value numeric;
begin
  select mi.*, item.category_multiplier
  into meat
  from public.meat_instances mi
  join public.meat_items item on item.id = mi.meat_item_id
  where mi.id = p_meat_instance_id;
  if meat is null then
    raise exception 'Unknown meat instance';
  end if;

  if meat.selected_equipment_item_id is not null then
    select coalesce(max(price_multiplier), 1)
    into equipment_multiplier
    from public.equipment_items
    where id = meat.selected_equipment_item_id;

    equipment_multiplier :=
      greatest(0, coalesce(equipment_multiplier, 1)) *
      public.private_equipment_compatibility_multiplier(meat.meat_item_id, meat.selected_equipment_item_id);
  end if;

  if meat.current_cooking_state <> 'burnt' then
    select coalesce(exp(sum(ln(greatest(effective_multiplier, 1)))), 1)
    into stacked_seasoning
    from public.meat_applied_seasonings
    where meat_instance_id = meat.id;
  end if;

  seasoning_multiplier := least(stacked_seasoning, greatest(1, equipment_multiplier));
  sale_modifier := greatest(1, public.private_active_sale_multiplier(meat.user_id));

  base_value :=
    meat.spawned_weight *
    meat.base_meat_value_snapshot *
    meat.category_multiplier *
    public.private_state_multiplier(meat.current_cooking_state) *
    public.private_doneness_multiplier(meat.current_cooking_state) *
    public.private_quality_multiplier(meat.current_cooking_state) *
    equipment_multiplier;

  if public.private_is_saleable_cooked_state(meat.current_cooking_state) then
    sale_floor :=
      meat.purchase_price_paid *
      public.private_cooked_profit_floor_multiplier(meat.current_cooking_state) *
      least(1, equipment_multiplier);
  end if;

  final_value := greatest(0, base_value, sale_floor) * seasoning_multiplier * sale_modifier;

  return round(final_value, 2);
end;
$$;

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
  if not public.private_is_saleable_cooked_state(p_target_cooking_state) then
    raise exception 'Invalid cooking target';
  end if;

  select ei.* into equipment
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

  if occupied_count >= equipment.cooking_slot_count then
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
    true
  )
  returning id into job_id;

  return job_id;
end;
$$;

create or replace function public.sell_all_meat()
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.private_current_user_id();
  meat record;
  payout numeric;
  total_payout numeric := 0;
  sold_count integer := 0;
  best_single_sale numeric := 0;
  profit numeric := 0;
begin
  perform public.initialize_player_save();
  perform public.resolve_time_progress();

  for meat in
    select *
    from public.meat_instances
    where user_id = v_user_id
      and sold_at is null
      and public.private_is_saleable_cooked_state(current_cooking_state)
    for update
  loop
    payout := public.private_calculate_sale_value(meat.id);
    total_payout := total_payout + payout;
    sold_count := sold_count + 1;
    best_single_sale := greatest(best_single_sale, payout);
    profit := greatest(profit, payout - meat.purchase_price_paid);

    update public.meat_instances
    set sold_at = now(),
        final_sell_value = payout
    where id = meat.id;
  end loop;

  if sold_count = 0 then
    return 0;
  end if;

  update public.player_saves
  set balance = balance + total_payout,
      lifetime_earned = lifetime_earned + total_payout,
      last_saved_at = now()
  where user_id = v_user_id;

  update public.lifetime_statistics
  set total_meat_sold = total_meat_sold + sold_count,
      total_money_earned_from_sales = total_money_earned_from_sales + total_payout,
      best_sale_value = greatest(best_sale_value, best_single_sale),
      highest_balance_reached = greatest(
        highest_balance_reached,
        (select balance from public.player_saves where user_id = v_user_id)
      ),
      largest_single_profit = greatest(largest_single_profit, profit),
      updated_at = now()
  where user_id = v_user_id;

  perform public.private_sync_shop_stage(v_user_id);
  return total_payout;
end;
$$;

create or replace function public.sell_meat(p_meat_instance_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.private_current_user_id();
  meat record;
  payout numeric;
  profit numeric;
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
    raise exception 'Unknown unsold meat instance';
  end if;

  if not public.private_is_saleable_cooked_state(meat.current_cooking_state) then
    raise exception 'Meat must be cooked before selling';
  end if;

  payout := public.private_calculate_sale_value(meat.id);
  profit := payout - meat.purchase_price_paid;

  update public.meat_instances
  set sold_at = now(),
      final_sell_value = payout
  where id = meat.id;

  update public.player_saves
  set balance = balance + payout,
      lifetime_earned = lifetime_earned + payout,
      last_saved_at = now()
  where user_id = v_user_id;

  update public.lifetime_statistics
  set total_meat_sold = total_meat_sold + 1,
      total_money_earned_from_sales = total_money_earned_from_sales + payout,
      best_sale_value = greatest(best_sale_value, payout),
      highest_balance_reached = greatest(
        highest_balance_reached,
        (select balance from public.player_saves where user_id = v_user_id)
      ),
      largest_single_profit = greatest(largest_single_profit, profit),
      updated_at = now()
  where user_id = v_user_id;

  perform public.private_sync_shop_stage(v_user_id);
  return payout;
end;
$$;

delete from public.shop_stock_entries
where shop_type = 'meat';
