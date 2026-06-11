create extension if not exists pgcrypto;

create table if not exists public.weight_profiles (
  id text primary key,
  display_name text not null,
  tier_bias numeric not null default 1,
  tail_chance numeric not null default 0.01 check (tail_chance >= 0 and tail_chance <= 1),
  tail_anchor_kg numeric not null default 5 check (tail_anchor_kg > 0),
  tail_alpha numeric not null default 1.8 check (tail_alpha > 0),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.meat_items (
  id text primary key,
  display_name text not null,
  category text not null,
  cut_type text not null,
  purchase_price numeric(40, 2) not null check (purchase_price >= 0),
  base_meat_value numeric(40, 2) not null check (base_meat_value >= 0),
  access_tier text not null,
  shop_stage integer not null default 1 check (shop_stage >= 1),
  unlock_requirement_id text,
  starter_only boolean not null default false,
  shop_stock_policy text not null check (shop_stock_policy in ('permanent', 'rng')),
  base_shop_appearance_weight numeric not null default 1 check (base_shop_appearance_weight >= 0),
  rarity_class text not null,
  price_penalty_eligible boolean not null default false,
  weight_profile_id text not null references public.weight_profiles(id),
  meat_tags text[] not null default '{}',
  equipment_compatibility_tags text[] not null default '{}',
  seasoning_compatibility_tags text[] not null default '{}',
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.equipment_items (
  id text primary key,
  display_name text not null,
  equipment_type text not null,
  purchase_price numeric(40, 2) not null check (purchase_price >= 0),
  price_multiplier numeric(40, 4) not null check (price_multiplier >= 0),
  cooking_slot_count integer not null check (cooking_slot_count between 1 and 30),
  unlock_requirement_id text,
  equipment_tags text[] not null default '{}',
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.seasoning_items (
  id text primary key,
  display_name text not null,
  seasoning_type text not null,
  purchase_price numeric(40, 2) not null check (purchase_price >= 0),
  base_multiplier numeric(40, 4) not null check (base_multiplier >= 1),
  maximum_uses integer not null check (maximum_uses > 0),
  rarity_class text not null,
  spawn_weight numeric not null check (spawn_weight >= 0),
  seasoning_tags text[] not null default '{}',
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.player_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  save_version integer not null default 1,
  data_version jsonb not null default '{}'::jsonb,
  balance numeric(60, 2) not null default 2000.00 check (balance >= 0),
  lifetime_earned numeric(60, 2) not null default 0,
  lifetime_spent numeric(60, 2) not null default 0,
  current_shop_stage integer not null default 1,
  created_at timestamptz not null default now(),
  last_saved_at timestamptz not null default now(),
  last_loaded_at timestamptz not null default now()
);

create table if not exists public.lifetime_statistics (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_meat_bought integer not null default 0,
  total_meat_sold integer not null default 0,
  total_seasonings_applied integer not null default 0,
  total_money_spent_on_meat numeric(60, 2) not null default 0,
  total_money_spent_on_equipment numeric(60, 2) not null default 0,
  total_money_spent_on_seasoning numeric(60, 2) not null default 0,
  total_money_earned_from_sales numeric(60, 2) not null default 0,
  best_sale_value numeric(60, 2) not null default 0,
  highest_balance_reached numeric(60, 2) not null default 2000,
  largest_single_profit numeric(60, 2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.player_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  number_format text not null default 'compact',
  danger_confirmations jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.owned_equipment (
  user_id uuid not null references auth.users(id) on delete cascade,
  equipment_item_id text not null references public.equipment_items(id),
  active boolean not null default true,
  acquired_at timestamptz not null default now(),
  primary key (user_id, equipment_item_id)
);

create table if not exists public.owned_seasoning_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seasoning_item_id text not null references public.seasoning_items(id),
  remaining_uses integer not null check (remaining_uses >= 0),
  maximum_uses integer not null check (maximum_uses > 0),
  acquired_at timestamptz not null default now()
);

create table if not exists public.meat_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meat_item_id text not null references public.meat_items(id),
  purchase_price_paid numeric(40, 2) not null check (purchase_price_paid >= 0),
  spawned_weight numeric(60, 4) not null check (spawned_weight >= 0),
  weight_rarity_result text not null default 'normal',
  base_meat_value_snapshot numeric(40, 2) not null check (base_meat_value_snapshot >= 0),
  current_cooking_state text not null default 'raw',
  selected_equipment_item_id text references public.equipment_items(id),
  spoilage_started_at timestamptz,
  spoilage_due_at timestamptz,
  spoiled_at timestamptz,
  sold_at timestamptz,
  final_sell_value numeric(60, 2),
  created_at timestamptz not null default now(),
  check (
    current_cooking_state in (
      'raw',
      'undercooked',
      'cooked',
      'well_cooked',
      'perfectly_cooked',
      'overcooked',
      'burnt',
      'spoiled'
    )
  )
);

create table if not exists public.cooking_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meat_instance_id uuid not null references public.meat_instances(id) on delete cascade,
  equipment_item_id text not null references public.equipment_items(id),
  equipment_slot_index integer not null check (equipment_slot_index >= 0),
  cooking_started_at timestamptz not null,
  cooking_target_end_at timestamptz not null,
  cooking_duration_seconds integer not null check (cooking_duration_seconds > 0),
  target_cooking_state text not null,
  cooking_completed boolean not null default false,
  cooking_completed_at timestamptz,
  auto_stop_at_target boolean not null default true,
  created_at timestamptz not null default now(),
  check (target_cooking_state in ('cooked', 'well_cooked', 'perfectly_cooked', 'overcooked'))
);

create table if not exists public.meat_applied_seasonings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meat_instance_id uuid not null references public.meat_instances(id) on delete cascade,
  seasoning_instance_id uuid not null references public.owned_seasoning_instances(id),
  effective_multiplier numeric(40, 4) not null check (effective_multiplier >= 1),
  applied_at timestamptz not null default now(),
  unique (meat_instance_id, seasoning_instance_id)
);

create table if not exists public.shop_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_type text not null check (shop_type in ('meat', 'seasoning', 'equipment')),
  unlocked boolean not null default true,
  refresh_due_at timestamptz,
  refresh_speed_level integer not null default 0 check (refresh_speed_level >= 0),
  luck_level integer not null default 0 check (luck_level >= 0),
  luck_multiplier numeric(20, 4) not null default 1,
  shop_stage integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, shop_type)
);

create table if not exists public.shop_stock_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_type text not null check (shop_type in ('meat', 'seasoning')),
  item_type text not null check (item_type in ('meat', 'seasoning')),
  item_id text not null,
  purchase_price numeric(40, 2) not null check (purchase_price >= 0),
  current_stock integer not null check (current_stock >= 0),
  maximum_stock integer not null check (maximum_stock >= 0),
  base_spawn_weight numeric not null default 1,
  final_spawn_weight numeric not null default 1,
  rarity_class text not null,
  shop_stage integer not null default 1,
  visibility_state text not null default 'visible',
  generated_at timestamptz not null default now()
);

create index if not exists meat_instances_user_unsold_idx on public.meat_instances(user_id, sold_at) where sold_at is null;
create index if not exists cooking_jobs_user_active_idx on public.cooking_jobs(user_id, cooking_completed) where cooking_completed = false;
create index if not exists shop_stock_user_shop_idx on public.shop_stock_entries(user_id, shop_type);
create index if not exists owned_seasonings_user_idx on public.owned_seasoning_instances(user_id, seasoning_item_id);

alter table public.player_saves enable row level security;
alter table public.lifetime_statistics enable row level security;
alter table public.player_preferences enable row level security;
alter table public.owned_equipment enable row level security;
alter table public.owned_seasoning_instances enable row level security;
alter table public.meat_instances enable row level security;
alter table public.cooking_jobs enable row level security;
alter table public.meat_applied_seasonings enable row level security;
alter table public.shop_states enable row level security;
alter table public.shop_stock_entries enable row level security;

create policy "catalog readable by authenticated users" on public.weight_profiles for select using (auth.role() = 'authenticated');
create policy "meat catalog readable by authenticated users" on public.meat_items for select using (auth.role() = 'authenticated');
create policy "equipment catalog readable by authenticated users" on public.equipment_items for select using (auth.role() = 'authenticated');
create policy "seasoning catalog readable by authenticated users" on public.seasoning_items for select using (auth.role() = 'authenticated');

alter table public.weight_profiles enable row level security;
alter table public.meat_items enable row level security;
alter table public.equipment_items enable row level security;
alter table public.seasoning_items enable row level security;

create policy "players read own saves" on public.player_saves for select using (auth.uid() = user_id);
create policy "players read own stats" on public.lifetime_statistics for select using (auth.uid() = user_id);
create policy "players read own preferences" on public.player_preferences for select using (auth.uid() = user_id);
create policy "players read own equipment" on public.owned_equipment for select using (auth.uid() = user_id);
create policy "players read own seasonings" on public.owned_seasoning_instances for select using (auth.uid() = user_id);
create policy "players read own meats" on public.meat_instances for select using (auth.uid() = user_id);
create policy "players read own cooking jobs" on public.cooking_jobs for select using (auth.uid() = user_id);
create policy "players read own applied seasonings" on public.meat_applied_seasonings for select using (auth.uid() = user_id);
create policy "players read own shop states" on public.shop_states for select using (auth.uid() = user_id);
create policy "players read own shop stock" on public.shop_stock_entries for select using (auth.uid() = user_id);

create or replace function public.private_current_user_id()
returns uuid
language sql
stable
as $$
  select coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
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

  body_roll := 0.25 + (random() * 4.75 * profile.tier_bias);

  if random() < profile.tail_chance then
    tail_roll := profile.tail_anchor_kg / power(greatest(random(), 0.000001), 1 / profile.tail_alpha);
    spawned_weight := round(tail_roll, 4);
    rarity_result := 'jackpot';
  else
    spawned_weight := round(body_roll, 4);
    rarity_result := case
      when body_roll >= 4 then 'heavy'
      when body_roll >= 2.5 then 'large'
      else 'normal'
    end;
  end if;

  return next;
end;
$$;

create or replace function public.private_state_multiplier(p_state text)
returns numeric
language sql
immutable
as $$
  select case p_state
    when 'raw' then 1
    when 'undercooked' then 0.65
    when 'cooked' then 1.25
    when 'well_cooked' then 1.6
    when 'perfectly_cooked' then 2.2
    when 'overcooked' then 0.6
    when 'burnt' then 0.1
    when 'spoiled' then 0
    else 1
  end;
$$;

create or replace function public.private_doneness_multiplier(p_state text)
returns numeric
language sql
immutable
as $$
  select case p_state
    when 'raw' then 1
    when 'undercooked' then 0.85
    when 'cooked' then 1
    when 'well_cooked' then 1.08
    when 'perfectly_cooked' then 1.2
    when 'overcooked' then 0.75
    when 'burnt' then 0.2
    when 'spoiled' then 0
    else 1
  end;
$$;

create or replace function public.private_quality_multiplier(p_state text)
returns numeric
language sql
immutable
as $$
  select case p_state
    when 'raw' then 1
    when 'undercooked' then 0.9
    when 'cooked' then 1
    when 'well_cooked' then 1.05
    when 'perfectly_cooked' then 1.15
    when 'overcooked' then 0.65
    when 'burnt' then 0.1
    when 'spoiled' then 0
    else 1
  end;
$$;

create or replace function public.private_refresh_shop_stock(p_user_id uuid, p_shop_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  state record;
begin
  select * into state from public.shop_states where user_id = p_user_id and shop_type = p_shop_type for update;
  if state is null then
    raise exception 'Missing shop state';
  end if;

  if p_shop_type in ('meat', 'seasoning') then
    delete from public.shop_stock_entries where user_id = p_user_id and shop_type = p_shop_type;
  end if;

  if p_shop_type = 'meat' then
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
    select
      p_user_id,
      'meat',
      'meat',
      id,
      purchase_price,
      greatest(1, floor(random() * 6 + 1)::integer),
      10,
      base_shop_appearance_weight,
      base_shop_appearance_weight * state.luck_multiplier,
      rarity_class,
      shop_stage
    from public.meat_items
    where enabled = true
      and starter_only = false
      and shop_stage <= state.shop_stage
    order by random()
    limit 12;
  elsif p_shop_type = 'seasoning' then
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
    select
      p_user_id,
      'seasoning',
      'seasoning',
      id,
      purchase_price,
      greatest(1, floor(random() * 4 + 1)::integer),
      6,
      spawn_weight,
      spawn_weight * state.luck_multiplier,
      rarity_class,
      1
    from public.seasoning_items
    where enabled = true
    order by random()
    limit 10;
  end if;

  update public.shop_states
  set refresh_due_at = now() + make_interval(mins => greatest(10, 60 - refresh_speed_level * 5)),
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

  update public.meat_instances
  set current_cooking_state = 'spoiled',
      spoiled_at = spoilage_due_at
  where user_id = v_user_id
    and sold_at is null
    and current_cooking_state in ('cooked', 'well_cooked', 'perfectly_cooked')
    and spoilage_due_at is not null
    and now() >= spoilage_due_at;

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

create or replace function public.initialize_player_save()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.private_current_user_id();
begin
  if v_user_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Authentication required';
  end if;

  insert into public.player_saves (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  insert into public.lifetime_statistics (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  insert into public.player_preferences (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  insert into public.owned_equipment (user_id, equipment_item_id, active)
  values (v_user_id, 'countertop_oven', true)
  on conflict (user_id, equipment_item_id) do nothing;

  insert into public.shop_states (user_id, shop_type, refresh_due_at, shop_stage)
  values
    (v_user_id, 'meat', now(), 1),
    (v_user_id, 'seasoning', now(), 1),
    (v_user_id, 'equipment', null, 1)
  on conflict (user_id, shop_type) do nothing;

  perform public.resolve_time_progress();
end;
$$;

create or replace function public.buy_meat(p_meat_item_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.private_current_user_id();
  meat record;
  weight_result record;
  stock_entry record;
  new_instance_id uuid;
begin
  perform public.initialize_player_save();
  perform public.resolve_time_progress();

  select * into meat from public.meat_items where id = p_meat_item_id and enabled = true;
  if meat is null then
    raise exception 'Unknown meat item';
  end if;

  if not meat.starter_only then
    select * into stock_entry
    from public.shop_stock_entries
    where user_id = v_user_id
      and shop_type = 'meat'
      and item_id = p_meat_item_id
      and current_stock > 0
    for update;

    if stock_entry is null then
      raise exception 'Meat is not in stock';
    end if;
  end if;

  update public.player_saves
  set balance = balance - meat.purchase_price,
      lifetime_spent = lifetime_spent + meat.purchase_price,
      last_saved_at = now()
  where user_id = v_user_id and balance >= meat.purchase_price;

  if not found then
    raise exception 'Insufficient balance';
  end if;

  if not meat.starter_only then
    update public.shop_stock_entries
    set current_stock = current_stock - 1
    where id = stock_entry.id;
  end if;

  select * into weight_result from public.private_roll_weight(meat.weight_profile_id);

  insert into public.meat_instances (
    user_id,
    meat_item_id,
    purchase_price_paid,
    spawned_weight,
    weight_rarity_result,
    base_meat_value_snapshot
  )
  values (
    v_user_id,
    meat.id,
    meat.purchase_price,
    weight_result.spawned_weight,
    weight_result.rarity_result,
    meat.base_meat_value
  )
  returning id into new_instance_id;

  update public.lifetime_statistics
  set total_meat_bought = total_meat_bought + 1,
      total_money_spent_on_meat = total_money_spent_on_meat + meat.purchase_price,
      updated_at = now()
  where user_id = v_user_id;

  return new_instance_id;
end;
$$;

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

  if exists (
    select 1 from public.owned_equipment
    where user_id = v_user_id and equipment_item_id = item.id
  ) then
    return;
  end if;

  update public.player_saves
  set balance = balance - item.purchase_price,
      lifetime_spent = lifetime_spent + item.purchase_price,
      last_saved_at = now()
  where user_id = v_user_id and balance >= item.purchase_price;

  if not found then
    raise exception 'Insufficient balance';
  end if;

  insert into public.owned_equipment (user_id, equipment_item_id, active)
  values (v_user_id, item.id, true);

  update public.lifetime_statistics
  set total_money_spent_on_equipment = total_money_spent_on_equipment + item.purchase_price,
      updated_at = now()
  where user_id = v_user_id;
end;
$$;

create or replace function public.buy_seasoning(p_seasoning_item_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.private_current_user_id();
  item record;
  stock_entry record;
  instance_id uuid;
begin
  perform public.initialize_player_save();
  perform public.resolve_time_progress();

  select * into item from public.seasoning_items where id = p_seasoning_item_id and enabled = true;
  if item is null then
    raise exception 'Unknown seasoning item';
  end if;

  select * into stock_entry
  from public.shop_stock_entries
  where user_id = v_user_id
    and shop_type = 'seasoning'
    and item_id = p_seasoning_item_id
    and current_stock > 0
  for update;

  if stock_entry is null then
    raise exception 'Seasoning is not in stock';
  end if;

  update public.player_saves
  set balance = balance - item.purchase_price,
      lifetime_spent = lifetime_spent + item.purchase_price,
      last_saved_at = now()
  where user_id = v_user_id and balance >= item.purchase_price;

  if not found then
    raise exception 'Insufficient balance';
  end if;

  update public.shop_stock_entries
  set current_stock = current_stock - 1
  where id = stock_entry.id;

  insert into public.owned_seasoning_instances (
    user_id,
    seasoning_item_id,
    remaining_uses,
    maximum_uses
  )
  values (v_user_id, item.id, item.maximum_uses, item.maximum_uses)
  returning id into instance_id;

  update public.lifetime_statistics
  set total_money_spent_on_seasoning = total_money_spent_on_seasoning + item.purchase_price,
      updated_at = now()
  where user_id = v_user_id;

  return instance_id;
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
  if p_target_cooking_state not in ('cooked', 'well_cooked', 'perfectly_cooked', 'overcooked') then
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
    round(90 * least(8, sqrt(greatest(meat.spawned_weight, 0.25))) *
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
  slot_limit integer;
  applied_count integer;
  durability_strength numeric;
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

  durability_strength := case
    when seasoning_instance.remaining_uses::numeric / seasoning_instance.maximum_uses <= 0.10 then 0.75
    when seasoning_instance.remaining_uses::numeric / seasoning_instance.maximum_uses <= 0.30 then 0.90
    else 1
  end;

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
    greatest(1, 1 + ((seasoning.base_multiplier - 1) * durability_strength))
  );

  update public.owned_seasoning_instances
  set remaining_uses = remaining_uses - 1
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
  final_value numeric;
begin
  select * into meat from public.meat_instances where id = p_meat_instance_id;
  if meat is null then
    raise exception 'Unknown meat instance';
  end if;

  if meat.selected_equipment_item_id is not null then
    select greatest(1, price_multiplier)
    into equipment_multiplier
    from public.equipment_items
    where id = meat.selected_equipment_item_id;
  end if;

  select coalesce(exp(sum(ln(greatest(effective_multiplier, 1)))), 1)
  into stacked_seasoning
  from public.meat_applied_seasonings
  where meat_instance_id = meat.id;

  seasoning_multiplier := least(stacked_seasoning, equipment_multiplier);

  final_value :=
    meat.spawned_weight *
    meat.base_meat_value_snapshot *
    public.private_state_multiplier(meat.current_cooking_state) *
    public.private_doneness_multiplier(meat.current_cooking_state) *
    public.private_quality_multiplier(meat.current_cooking_state) *
    equipment_multiplier *
    seasoning_multiplier;

  return round(greatest(0, final_value), 2);
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

  return payout;
end;
$$;

grant execute on function public.initialize_player_save() to authenticated;
grant execute on function public.resolve_time_progress() to authenticated;
grant execute on function public.buy_meat(text) to authenticated;
grant execute on function public.buy_equipment(text) to authenticated;
grant execute on function public.buy_seasoning(text) to authenticated;
grant execute on function public.start_cooking(uuid, text, text) to authenticated;
grant execute on function public.apply_seasoning(uuid, uuid) to authenticated;
grant execute on function public.sell_meat(uuid) to authenticated;
