alter table public.weight_profiles
  add column if not exists body_min_kg numeric(60, 4) not null default 0.25,
  add column if not exists body_max_kg numeric(60, 4) not null default 5,
  add column if not exists body_shape numeric(20, 4) not null default 1,
  add column if not exists large_threshold_kg numeric(60, 4) not null default 2.5,
  add column if not exists heavy_threshold_kg numeric(60, 4) not null default 4,
  add column if not exists massive_threshold_kg numeric(60, 4) not null default 8;

alter table public.meat_items
  add column if not exists category_multiplier numeric(20, 4) not null default 1;

create table if not exists public.sale_modifier_definitions (
  id text primary key,
  display_name text not null,
  source_type text not null check (source_type in ('event', 'temporary', 'permanent', 'global')),
  multiplier numeric(20, 4) not null check (multiplier > 0 and multiplier <= 5),
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.player_sale_modifiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  definition_id text not null references public.sale_modifier_definitions(id),
  source_type text not null check (source_type in ('event', 'temporary', 'permanent', 'global')),
  multiplier numeric(20, 4) not null check (multiplier > 0 and multiplier <= 5),
  claimed_at timestamptz not null default now(),
  expires_at timestamptz,
  active boolean not null default true,
  unique (user_id, definition_id)
);

alter table public.sale_modifier_definitions enable row level security;
alter table public.player_sale_modifiers enable row level security;

create policy "sale modifier definitions readable by authenticated users"
  on public.sale_modifier_definitions for select using (auth.role() = 'authenticated');

create policy "players read own sale modifiers"
  on public.player_sale_modifiers for select using (auth.uid() = user_id);

insert into public.sale_modifier_definitions (id, display_name, source_type, multiplier, duration_minutes)
values ('opening_weekend', 'Opening Weekend', 'event', 1.05, 240)
on conflict (id) do update
set display_name = excluded.display_name,
    source_type = excluded.source_type,
    multiplier = excluded.multiplier,
    duration_minutes = excluded.duration_minutes,
    enabled = true,
    updated_at = now();

create or replace function public.private_stage_multiplier(p_shop_stage integer)
returns numeric
language sql
immutable
as $$
  select case greatest(1, p_shop_stage)
    when 1 then 1
    when 2 then 5
    when 3 then 25
    when 4 then 150
    when 5 then 1000
    else 10000
  end;
$$;

create or replace function public.private_stage_reference_price(p_shop_stage integer)
returns numeric
language sql
immutable
as $$
  select case greatest(1, p_shop_stage)
    when 1 then 25
    when 2 then 320
    when 3 then 9500
    when 4 then 120000
    when 5 then 680000
    else 1800000000
  end;
$$;

create or replace function public.private_refresh_minutes(p_refresh_speed_level integer)
returns integer
language sql
immutable
as $$
  select greatest(30, 180 - (greatest(0, p_refresh_speed_level) * 15));
$$;

create or replace function public.private_luck_modifier(p_luck_level integer, p_rarity_class text)
returns numeric
language plpgsql
immutable
as $$
declare
  sensitivity numeric;
  luck_multiplier numeric;
begin
  sensitivity := case lower(coalesce(p_rarity_class, ''))
    when 'starter' then 0
    when 'starter-adjacent' then 0.20
    when 'basic' then 0.35
    when 'common upgrade' then 0.55
    when 'specialty' then 0.75
    when 'luxury' then 0.90
    when 'extreme luxury' then 1.00
    else 0.50
  end;
  luck_multiplier := 1 + (0.9 * greatest(0, p_luck_level));
  return 1 + ((luck_multiplier - 1) * sensitivity);
end;
$$;

create or replace function public.private_manual_refresh_cost(
  p_shop_type text,
  p_shop_stage integer,
  p_luck_level integer
)
returns numeric
language sql
immutable
as $$
  select round(
    (case p_shop_type when 'meat' then 50 when 'seasoning' then 100 else 0 end) *
    public.private_stage_multiplier(p_shop_stage) *
    (1 + (greatest(0, p_luck_level) * 0.15)),
    2
  );
$$;

create or replace function public.private_refresh_speed_upgrade_cost(
  p_shop_type text,
  p_shop_stage integer,
  p_current_level integer
)
returns numeric
language sql
immutable
as $$
  select round(
    ((case p_shop_type when 'meat' then 1000 when 'seasoning' then 2000 else 0 end) *
    power(greatest(0, p_current_level) + 1, 2) *
    power(1.65, greatest(0, p_current_level)))::numeric *
    public.private_stage_multiplier(p_shop_stage),
    2
  );
$$;

create or replace function public.private_luck_upgrade_cost(
  p_shop_type text,
  p_shop_stage integer,
  p_current_level integer
)
returns numeric
language sql
immutable
as $$
  select round(
    ((case p_shop_type when 'meat' then 5000 when 'seasoning' then 7500 else 0 end) *
    power(greatest(0, p_current_level) + 1, 2.4) *
    power(1.85, greatest(0, p_current_level)))::numeric *
    public.private_stage_multiplier(p_shop_stage),
    2
  );
$$;

create or replace function public.private_sync_shop_stage(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  progress_value numeric;
  next_stage integer;
begin
  select greatest(coalesce(ps.balance, 0), coalesce(ls.highest_balance_reached, 0))
  into progress_value
  from public.player_saves ps
  left join public.lifetime_statistics ls on ls.user_id = ps.user_id
  where ps.user_id = p_user_id;

  next_stage := case
    when progress_value >= 1800000000 then 6
    when progress_value >= 680000 then 5
    when progress_value >= 120000 then 4
    when progress_value >= 9500 then 3
    when progress_value >= 320 then 2
    else 1
  end;

  update public.player_saves
  set current_shop_stage = next_stage,
      last_saved_at = now()
  where user_id = p_user_id;

  update public.shop_states
  set shop_stage = next_stage,
      updated_at = now()
  where user_id = p_user_id;

  return next_stage;
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
  body_roll numeric;
  tail_roll numeric;
begin
  select * into profile from public.weight_profiles where id = p_profile_id and enabled = true;
  if profile is null then
    raise exception 'Missing weight profile %', p_profile_id;
  end if;

  body_roll :=
    profile.body_min_kg +
    ((profile.body_max_kg - profile.body_min_kg) * power(random(), greatest(profile.body_shape, 0.01)));

  if random() < profile.tail_chance then
    tail_roll := profile.tail_anchor_kg / power(greatest(random(), 0.000001), 1 / profile.tail_alpha);
    spawned_weight := round(tail_roll, 4);
    rarity_result := 'jackpot';
  else
    spawned_weight := round(body_roll, 4);
    rarity_result := case
      when body_roll >= profile.massive_threshold_kg then 'massive'
      when body_roll >= profile.heavy_threshold_kg then 'heavy'
      when body_roll >= profile.large_threshold_kg then 'large'
      when body_roll <= profile.body_min_kg + ((profile.body_max_kg - profile.body_min_kg) * 0.25) then 'small'
      else 'normal'
    end;
  end if;

  return next;
end;
$$;

create or replace function public.private_equipment_compatibility_multiplier(
  p_meat_item_id text,
  p_equipment_item_id text
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  overlap_count integer;
begin
  select count(*)
  into overlap_count
  from public.meat_items mi
  join public.equipment_items ei on ei.id = p_equipment_item_id
  cross join lateral unnest(mi.equipment_compatibility_tags) as meat_tag(tag)
  cross join lateral unnest(ei.equipment_tags) as equipment_tag(tag)
  where mi.id = p_meat_item_id
    and equipment_tag.tag = meat_tag.tag;

  return case
    when overlap_count >= 2 then 1.15
    when overlap_count = 1 then 1.05
    else 1
  end;
end;
$$;

create or replace function public.private_seasoning_compatibility(
  p_meat_item_id text,
  p_equipment_item_id text,
  p_seasoning_item_id text
)
returns table(strength numeric, match_level text)
language plpgsql
security definer
set search_path = public
as $$
declare
  meat_overlap integer;
  equipment_overlap integer;
  has_bad_tag boolean;
begin
  select exists(
    select 1
    from public.seasoning_items si
    cross join lateral unnest(si.seasoning_tags) as seasoning_tag(tag)
    where si.id = p_seasoning_item_id
      and seasoning_tag.tag = 'bad_match'
  )
  into has_bad_tag;

  if has_bad_tag then
    strength := 0.75;
    match_level := 'bad';
    return next;
    return;
  end if;

  select count(*)
  into meat_overlap
  from public.meat_items mi
  join public.seasoning_items si on si.id = p_seasoning_item_id
  cross join lateral unnest(mi.seasoning_compatibility_tags) as meat_tag(tag)
  cross join lateral unnest(si.seasoning_tags) as seasoning_tag(tag)
  where mi.id = p_meat_item_id
    and seasoning_tag.tag = meat_tag.tag;

  select count(*)
  into equipment_overlap
  from public.equipment_items ei
  join public.seasoning_items si on si.id = p_seasoning_item_id
  cross join lateral unnest(ei.equipment_tags) as equipment_tag(tag)
  cross join lateral unnest(si.seasoning_tags) as seasoning_tag(tag)
  where ei.id = p_equipment_item_id
    and seasoning_tag.tag = equipment_tag.tag;

  strength := case
    when meat_overlap > 0 and equipment_overlap > 0 then 1.50
    when meat_overlap >= 2 or equipment_overlap >= 2 then 1.25
    when meat_overlap > 0 or equipment_overlap > 0 then 1.10
    else 1.00
  end;
  match_level := case
    when strength = 1.50 then 'perfect'
    when strength = 1.25 then 'great'
    when strength = 1.10 then 'good'
    else 'neutral'
  end;
  return next;
end;
$$;

create or replace function public.private_active_sale_multiplier(p_user_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(exp(sum(ln(greatest(multiplier, 0.0001)))), 1)
  from public.player_sale_modifiers
  where user_id = p_user_id
    and active = true
    and (expires_at is null or now() < expires_at);
$$;

create or replace function public.private_refresh_shop_stock(p_user_id uuid, p_shop_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  state record;
  rolled_count integer;
begin
  perform public.private_sync_shop_stage(p_user_id);

  select * into state from public.shop_states where user_id = p_user_id and shop_type = p_shop_type for update;
  if state is null then
    raise exception 'Missing shop state';
  end if;

  if p_shop_type in ('meat', 'seasoning') then
    delete from public.shop_stock_entries where user_id = p_user_id and shop_type = p_shop_type;
  end if;

  if p_shop_type = 'meat' then
    rolled_count := greatest(1, floor(random() * 16 + 1)::integer);

    insert into public.shop_stock_entries (
      user_id,
      shop_type,
      item_type,
      item_id,
      purchase_price,
      current_stock,
      maximum_stock,
      base_spawn_weight,
      final_spawn_weight,
      rarity_class,
      shop_stage
    )
    with eligible as (
      select
        id,
        purchase_price,
        base_shop_appearance_weight,
        greatest(
          0.001,
          base_shop_appearance_weight *
          (1 / (1 + power(purchase_price / public.private_stage_reference_price(state.shop_stage), 1.35))) *
          public.private_luck_modifier(state.luck_level, rarity_class)
        ) as final_weight,
        rarity_class,
        shop_stage,
        lower(rarity_class) in ('luxury', 'extreme luxury') as luxury_or_higher
      from public.meat_items
      where enabled = true
        and starter_only = false
        and shop_stage <= state.shop_stage
    ),
    weighted as (
      select
        *,
        -ln(greatest(random(), 0.000001)) / final_weight as sort_key
      from eligible
    ),
    ranked as (
      select
        *,
        row_number() over (order by sort_key) as pick_rank,
        row_number() over (partition by luxury_or_higher order by sort_key) as luxury_rank
      from weighted
    )
    select
      p_user_id,
      'meat',
      'meat',
      id,
      purchase_price,
      greatest(
        1,
        least(
          10,
          floor((random() * 6 + 1) * least(1, greatest(0.15, final_weight / greatest(base_shop_appearance_weight, 0.001))))::integer
        )
      ),
      10,
      base_shop_appearance_weight,
      final_weight,
      rarity_class,
      shop_stage
    from ranked
    where pick_rank <= rolled_count
      and (luxury_or_higher = false or luxury_rank <= 2)
    order by sort_key;
  elsif p_shop_type = 'seasoning' then
    rolled_count := floor(random() * 4)::integer;

    insert into public.shop_stock_entries (
      user_id,
      shop_type,
      item_type,
      item_id,
      purchase_price,
      current_stock,
      maximum_stock,
      base_spawn_weight,
      final_spawn_weight,
      rarity_class,
      shop_stage
    )
    with eligible as (
      select
        id,
        purchase_price,
        spawn_weight,
        greatest(0.001, spawn_weight * public.private_luck_modifier(state.luck_level, rarity_class)) as final_weight,
        rarity_class
      from public.seasoning_items
      where enabled = true
    )
    select
      p_user_id,
      'seasoning',
      'seasoning',
      id,
      purchase_price,
      greatest(1, floor(random() * 4 + 1)::integer),
      6,
      spawn_weight,
      final_weight,
      rarity_class,
      state.shop_stage
    from eligible
    order by -ln(greatest(random(), 0.000001)) / final_weight
    limit rolled_count;
  end if;

  update public.shop_states
  set refresh_due_at = now() + make_interval(mins => public.private_refresh_minutes(refresh_speed_level)),
      updated_at = now()
  where user_id = p_user_id and shop_type = p_shop_type;
end;
$$;

create or replace function public.resolve_time_progress()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.private_current_user_id();
  due_shop record;
begin
  update public.cooking_jobs cj
  set cooking_completed = true,
      cooking_completed_at = cj.cooking_target_end_at
  where cj.user_id = v_user_id
    and cj.cooking_completed = false
    and now() >= cj.cooking_target_end_at;

  update public.meat_instances mi
  set current_cooking_state = cj.target_cooking_state,
      selected_equipment_item_id = cj.equipment_item_id,
      spoilage_started_at = case
        when cj.target_cooking_state in ('cooked', 'well_cooked', 'perfectly_cooked') then cj.cooking_target_end_at
        else null
      end,
      spoilage_due_at = case
        when cj.target_cooking_state in ('cooked', 'well_cooked', 'perfectly_cooked') then cj.cooking_target_end_at + interval '3 days'
        else null
      end
  from public.cooking_jobs cj
  where mi.id = cj.meat_instance_id
    and mi.user_id = v_user_id
    and cj.user_id = v_user_id
    and cj.cooking_completed = true
    and cj.cooking_completed_at = cj.cooking_target_end_at
    and mi.current_cooking_state <> cj.target_cooking_state;

  delete from public.meat_applied_seasonings mas
  using public.meat_instances mi
  where mas.meat_instance_id = mi.id
    and mi.user_id = v_user_id
    and mi.current_cooking_state = 'burnt';

  update public.meat_instances
  set current_cooking_state = 'spoiled',
      spoiled_at = spoilage_due_at
  where user_id = v_user_id
    and sold_at is null
    and current_cooking_state in ('cooked', 'well_cooked', 'perfectly_cooked')
    and spoilage_due_at is not null
    and now() >= spoilage_due_at;

  perform public.private_sync_shop_stage(v_user_id);

  for due_shop in
    select shop_type
    from public.shop_states
    where user_id = v_user_id
      and shop_type in ('meat', 'seasoning')
      and refresh_due_at is not null
      and now() >= refresh_due_at
  loop
    perform public.private_refresh_shop_stock(v_user_id, due_shop.shop_type);
  end loop;

  update public.player_saves
  set last_loaded_at = now(),
      last_saved_at = now()
  where user_id = v_user_id;
end;
$$;

create or replace function public.apply_seasoning(p_meat_instance_id uuid, p_seasoning_instance_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.private_current_user_id();
  meat record;
  seasoning_instance record;
  seasoning record;
  compatibility record;
  slot_limit integer;
  applied_count integer;
  slot_strength numeric;
  durability_strength numeric;
  durability_loss integer;
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

  slot_limit := case meat.current_cooking_state
    when 'cooked' then 3
    when 'well_cooked' then 4
    when 'perfectly_cooked' then 5
    else 0
  end;

  if slot_limit = 0 then
    raise exception 'Seasoning can only be applied to cooked, well cooked, or perfectly cooked meat';
  end if;

  select * into seasoning_instance
  from public.owned_seasoning_instances
  where id = p_seasoning_instance_id
    and user_id = v_user_id
  for update;

  if seasoning_instance is null or seasoning_instance.remaining_uses <= 0 then
    raise exception 'Seasoning is not usable';
  end if;

  select * into seasoning from public.seasoning_items where id = seasoning_instance.seasoning_item_id;

  select count(*) into applied_count
  from public.meat_applied_seasonings
  where meat_instance_id = meat.id;

  if applied_count >= slot_limit then
    raise exception 'No seasoning slot available';
  end if;

  if meat.selected_equipment_item_id is null then
    raise exception 'Cooked meat is missing selected equipment';
  end if;

  select * into compatibility
  from public.private_seasoning_compatibility(meat.meat_item_id, meat.selected_equipment_item_id, seasoning.id);

  slot_strength := case applied_count + 1
    when 1 then 1
    when 2 then 1
    when 3 then 1
    when 4 then 0.75
    when 5 then 0.50
    else 0.25
  end;

  durability_strength := case
    when seasoning_instance.remaining_uses::numeric / seasoning_instance.maximum_uses <= 0.10 then 0.75
    when seasoning_instance.remaining_uses::numeric / seasoning_instance.maximum_uses <= 0.30 then 0.90
    else 1
  end;
  durability_loss := case when compatibility.match_level = 'bad' then 2 else 1 end;

  insert into public.meat_applied_seasonings (
    user_id,
    meat_instance_id,
    seasoning_instance_id,
    effective_multiplier
  )
  values (
    v_user_id,
    meat.id,
    seasoning_instance.id,
    greatest(1, 1 + ((seasoning.base_multiplier - 1) * slot_strength * durability_strength * compatibility.strength))
  );

  update public.owned_seasoning_instances
  set remaining_uses = greatest(0, remaining_uses - durability_loss)
  where id = seasoning_instance.id;

  update public.lifetime_statistics
  set total_seasonings_applied = total_seasonings_applied + 1,
      updated_at = now()
  where user_id = v_user_id;
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
    select greatest(1, price_multiplier)
    into equipment_multiplier
    from public.equipment_items
    where id = meat.selected_equipment_item_id;

    equipment_multiplier :=
      equipment_multiplier *
      public.private_equipment_compatibility_multiplier(meat.meat_item_id, meat.selected_equipment_item_id);
  end if;

  if meat.current_cooking_state <> 'burnt' then
    select coalesce(exp(sum(ln(greatest(effective_multiplier, 1)))), 1)
    into stacked_seasoning
    from public.meat_applied_seasonings
    where meat_instance_id = meat.id;
  end if;

  seasoning_multiplier := least(stacked_seasoning, equipment_multiplier);
  sale_modifier := public.private_active_sale_multiplier(meat.user_id);

  final_value :=
    meat.spawned_weight *
    meat.base_meat_value_snapshot *
    meat.category_multiplier *
    public.private_state_multiplier(meat.current_cooking_state) *
    public.private_doneness_multiplier(meat.current_cooking_state) *
    public.private_quality_multiplier(meat.current_cooking_state) *
    equipment_multiplier *
    seasoning_multiplier *
    sale_modifier;

  return round(greatest(0, final_value), 2);
end;
$$;

create or replace function public.manual_refresh_shop(p_shop_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.private_current_user_id();
  requested text[];
  total_cost numeric;
  shop record;
begin
  perform public.initialize_player_save();
  perform public.resolve_time_progress();

  if p_shop_type = 'all' then
    requested := array['meat', 'seasoning'];
  elsif p_shop_type in ('meat', 'seasoning') then
    requested := array[p_shop_type];
  else
    raise exception 'Invalid refresh shop type';
  end if;

  select coalesce(sum(public.private_manual_refresh_cost(shop_type, shop_stage, luck_level)), 0)
  into total_cost
  from public.shop_states
  where user_id = v_user_id and shop_type = any(requested);

  update public.player_saves
  set balance = balance - total_cost,
      lifetime_spent = lifetime_spent + total_cost,
      last_saved_at = now()
  where user_id = v_user_id and balance >= total_cost;

  if not found then
    raise exception 'Insufficient balance';
  end if;

  for shop in select unnest(requested) as shop_type
  loop
    perform public.private_refresh_shop_stock(v_user_id, shop.shop_type);
  end loop;
end;
$$;

create or replace function public.buy_shop_refresh_speed(p_shop_type text)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.private_current_user_id();
  state record;
  cost numeric;
begin
  perform public.initialize_player_save();
  perform public.resolve_time_progress();

  if p_shop_type not in ('meat', 'seasoning') then
    raise exception 'Invalid shop type';
  end if;

  select * into state
  from public.shop_states
  where user_id = v_user_id and shop_type = p_shop_type
  for update;

  if state.refresh_speed_level >= 10 then
    raise exception 'Refresh speed is already at maximum level';
  end if;

  cost := public.private_refresh_speed_upgrade_cost(p_shop_type, state.shop_stage, state.refresh_speed_level);

  update public.player_saves
  set balance = balance - cost,
      lifetime_spent = lifetime_spent + cost,
      last_saved_at = now()
  where user_id = v_user_id and balance >= cost;

  if not found then
    raise exception 'Insufficient balance';
  end if;

  update public.shop_states
  set refresh_speed_level = refresh_speed_level + 1,
      refresh_due_at = now() + make_interval(mins => public.private_refresh_minutes(refresh_speed_level + 1)),
      updated_at = now()
  where user_id = v_user_id and shop_type = p_shop_type;

  return cost;
end;
$$;

create or replace function public.buy_shop_luck(p_shop_type text)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.private_current_user_id();
  state record;
  cost numeric;
begin
  perform public.initialize_player_save();
  perform public.resolve_time_progress();

  if p_shop_type not in ('meat', 'seasoning') then
    raise exception 'Invalid shop type';
  end if;

  select * into state
  from public.shop_states
  where user_id = v_user_id and shop_type = p_shop_type
  for update;

  cost := public.private_luck_upgrade_cost(p_shop_type, state.shop_stage, state.luck_level);

  update public.player_saves
  set balance = balance - cost,
      lifetime_spent = lifetime_spent + cost,
      last_saved_at = now()
  where user_id = v_user_id and balance >= cost;

  if not found then
    raise exception 'Insufficient balance';
  end if;

  update public.shop_states
  set luck_level = luck_level + 1,
      luck_multiplier = 1 + (0.9 * (luck_level + 1)),
      updated_at = now()
  where user_id = v_user_id and shop_type = p_shop_type;

  return cost;
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
    where user_id = v_user_id and sold_at is null
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

create or replace function public.sell_seasoning(p_seasoning_instance_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.private_current_user_id();
  seasoning_instance record;
  payout numeric;
begin
  perform public.initialize_player_save();

  select osi.*, si.purchase_price
  into seasoning_instance
  from public.owned_seasoning_instances osi
  join public.seasoning_items si on si.id = osi.seasoning_item_id
  where osi.id = p_seasoning_instance_id
    and osi.user_id = v_user_id
  for update;

  if seasoning_instance is null then
    raise exception 'Unknown seasoning instance';
  end if;

  payout := round(
    seasoning_instance.purchase_price *
    0.50 *
    (seasoning_instance.remaining_uses::numeric / seasoning_instance.maximum_uses),
    2
  );

  delete from public.owned_seasoning_instances where id = p_seasoning_instance_id;

  update public.player_saves
  set balance = balance + payout,
      lifetime_earned = lifetime_earned + payout,
      last_saved_at = now()
  where user_id = v_user_id;

  return payout;
end;
$$;

create or replace function public.destroy_equipment(p_equipment_item_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.private_current_user_id();
begin
  perform public.initialize_player_save();

  if exists (
    select 1 from public.cooking_jobs
    where user_id = v_user_id
      and equipment_item_id = p_equipment_item_id
      and cooking_completed = false
  ) then
    raise exception 'Cannot destroy equipment while it has active cooking jobs';
  end if;

  delete from public.owned_equipment
  where user_id = v_user_id
    and equipment_item_id = p_equipment_item_id;

  if not found then
    raise exception 'Equipment is not owned';
  end if;
end;
$$;

create or replace function public.claim_sale_modifier(p_modifier_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.private_current_user_id();
  modifier record;
begin
  perform public.initialize_player_save();

  select * into modifier
  from public.sale_modifier_definitions
  where id = p_modifier_id
    and enabled = true;

  if modifier is null then
    raise exception 'Unknown sale modifier';
  end if;

  insert into public.player_sale_modifiers (
    user_id,
    definition_id,
    source_type,
    multiplier,
    expires_at,
    active
  )
  values (
    v_user_id,
    modifier.id,
    modifier.source_type,
    modifier.multiplier,
    case
      when modifier.duration_minutes is null then null
      else now() + make_interval(mins => modifier.duration_minutes)
    end,
    true
  )
  on conflict (user_id, definition_id) do update
  set multiplier = excluded.multiplier,
      claimed_at = now(),
      expires_at = excluded.expires_at,
      active = true;
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

grant select on public.sale_modifier_definitions to authenticated;
grant select on public.player_sale_modifiers to authenticated;

grant execute on function public.manual_refresh_shop(text) to authenticated;
grant execute on function public.buy_shop_refresh_speed(text) to authenticated;
grant execute on function public.buy_shop_luck(text) to authenticated;
grant execute on function public.sell_all_meat() to authenticated;
grant execute on function public.sell_seasoning(uuid) to authenticated;
grant execute on function public.destroy_equipment(text) to authenticated;
grant execute on function public.claim_sale_modifier(text) to authenticated;
