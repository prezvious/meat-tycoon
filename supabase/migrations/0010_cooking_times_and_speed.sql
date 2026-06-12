-- Add explicit per-meat cooking times, equipment cooking speed, and locked long-cook rewards.
alter table public.meat_items
  add column if not exists default_weight_kg numeric(60, 4) not null default 1 check (default_weight_kg >= 1),
  add column if not exists default_cooked_seconds integer not null default 30 check (default_cooked_seconds between 30 and 28800),
  add column if not exists default_well_cooked_seconds integer not null default 60 check (default_well_cooked_seconds between 60 and 57600),
  add column if not exists default_perfectly_cooked_seconds integer not null default 180 check (default_perfectly_cooked_seconds between 180 and 86400),
  add column if not exists legendary_cooking_eligible boolean not null default false;

alter table public.equipment_items
  add column if not exists cooking_speed_multiplier numeric(8, 4) not null default 1 check (cooking_speed_multiplier between 1 and 2);

alter table public.meat_instances
  add column if not exists long_cook_multiplier_snapshot numeric(8, 4) not null default 1 check (long_cook_multiplier_snapshot between 1 and 10);

alter table public.cooking_jobs
  add column if not exists default_cooking_seconds_snapshot integer not null default 60 check (default_cooking_seconds_snapshot > 0),
  add column if not exists pre_equipment_cooking_seconds_snapshot integer not null default 60 check (pre_equipment_cooking_seconds_snapshot > 0),
  add column if not exists equipment_speed_multiplier_snapshot numeric(8, 4) not null default 1 check (equipment_speed_multiplier_snapshot between 1 and 2),
  add column if not exists long_cook_multiplier_snapshot numeric(8, 4) not null default 1 check (long_cook_multiplier_snapshot between 1 and 10);

-- Player-favorable migration: finish existing active jobs as Perfectly Cooked without long-cook bonus.
with active_jobs as (
  select *
  from public.cooking_jobs
  where cooking_completed = false
)
update public.meat_instances mi
set current_cooking_state = 'perfectly_cooked',
    selected_equipment_item_id = active_jobs.equipment_item_id,
    spoilage_started_at = now(),
    spoilage_due_at = now() + interval '3 days',
    long_cook_multiplier_snapshot = 1
from active_jobs
where mi.id = active_jobs.meat_instance_id
  and mi.sold_at is null;

update public.cooking_jobs
set target_cooking_state = 'perfectly_cooked',
    cooking_completed = true,
    cooking_completed_at = now(),
    cooking_target_end_at = now(),
    cooking_duration_seconds = greatest(1, floor(extract(epoch from (now() - cooking_started_at)))::integer),
    default_cooking_seconds_snapshot = greatest(1, default_cooking_seconds_snapshot),
    pre_equipment_cooking_seconds_snapshot = greatest(1, pre_equipment_cooking_seconds_snapshot),
    equipment_speed_multiplier_snapshot = 1,
    long_cook_multiplier_snapshot = 1
where cooking_completed = false;

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
  target_min_seconds integer;
  target_max_seconds integer;
  default_seconds integer;
  pre_equipment_seconds integer;
  duration_seconds integer;
  equipment_speed numeric;
  weight_factor numeric;
  long_cook_multiplier numeric;
  job_id uuid;
begin
  perform public.initialize_player_save();
  perform public.resolve_time_progress();

  select
    mi.*,
    item.default_weight_kg,
    item.default_cooked_seconds,
    item.default_well_cooked_seconds,
    item.default_perfectly_cooked_seconds,
    item.legendary_cooking_eligible
  into meat
  from public.meat_instances mi
  join public.meat_items item on item.id = mi.meat_item_id
  where mi.id = p_meat_instance_id
    and mi.user_id = v_user_id
    and mi.sold_at is null
  for update;

  if meat is null then
    raise exception 'Unknown meat instance';
  end if;
  if meat.current_cooking_state <> 'raw' then
    raise exception 'Only raw meat can start cooking';
  end if;
  if p_target_cooking_state not in ('cooked', 'well_cooked', 'perfectly_cooked') then
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

  target_min_seconds := case p_target_cooking_state
    when 'well_cooked' then 60
    when 'perfectly_cooked' then 180
    else 30
  end;

  target_max_seconds := case p_target_cooking_state
    when 'well_cooked' then 57600
    when 'perfectly_cooked' then 86400
    else 28800
  end;

  default_seconds := case p_target_cooking_state
    when 'well_cooked' then meat.default_well_cooked_seconds
    when 'perfectly_cooked' then meat.default_perfectly_cooked_seconds
    else meat.default_cooked_seconds
  end;
  default_seconds := least(target_max_seconds, greatest(target_min_seconds, coalesce(default_seconds, target_min_seconds)));

  weight_factor := least(
    6,
    greatest(
      0.35,
      power(greatest(meat.spawned_weight, 1.00) / greatest(coalesce(meat.default_weight_kg, 1), 1), 0.75)
    )
  );

  pre_equipment_seconds := round(default_seconds * weight_factor)::integer;
  pre_equipment_seconds := least(
    case
      when meat.legendary_cooking_eligible then target_max_seconds
      else least(target_max_seconds, 7200)
    end,
    greatest(target_min_seconds, pre_equipment_seconds)
  );

  equipment_speed := least(2, greatest(1, coalesce(equipment.cooking_speed_multiplier, 1)));
  duration_seconds := least(43200, greatest(15, round(pre_equipment_seconds / equipment_speed)::integer));

  long_cook_multiplier := case
    when default_seconds < 21600 then 1
    else round((1 + (((least(default_seconds, 86400) - 21600)::numeric / (86400 - 21600)) * 9))::numeric, 4)
  end;

  slot_index := occupied_count;

  insert into public.cooking_jobs (
    user_id,
    meat_instance_id,
    equipment_item_id,
    equipment_slot_index,
    cooking_started_at,
    cooking_target_end_at,
    cooking_duration_seconds,
    default_cooking_seconds_snapshot,
    pre_equipment_cooking_seconds_snapshot,
    equipment_speed_multiplier_snapshot,
    long_cook_multiplier_snapshot,
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
    default_seconds,
    pre_equipment_seconds,
    equipment_speed,
    long_cook_multiplier,
    p_target_cooking_state,
    false,
    true
  )
  returning id into job_id;

  update public.meat_instances
  set current_cooking_state = 'cooking',
      selected_equipment_item_id = equipment.id,
      long_cook_multiplier_snapshot = long_cook_multiplier
  where id = meat.id;

  return job_id;
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
  long_cook_multiplier numeric := 1;
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

  seasoning_multiplier := stacked_seasoning;
  sale_modifier := greatest(1, public.private_active_sale_multiplier(meat.user_id));
  long_cook_multiplier := greatest(1, coalesce(meat.long_cook_multiplier_snapshot, 1));

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

  final_value := greatest(0, base_value, sale_floor) * seasoning_multiplier * long_cook_multiplier * sale_modifier;

  return round(final_value, 2);
end;
$$;
