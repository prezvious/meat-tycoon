-- Adjust Shop Restock Timer to default to 180 seconds and scale down to 30 seconds with upgrades

-- Drop the old minutes-based helper function
drop function if exists public.private_refresh_minutes(integer);

-- Create the new seconds-based helper function
create or replace function public.private_refresh_seconds(p_refresh_speed_level integer)
returns integer
language sql
immutable
as $$
  select greatest(30, 180 - (greatest(0, p_refresh_speed_level) * 15));
$$;

-- Re-define private_refresh_shop_stock using the new seconds-based interval
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
  set refresh_due_at = now() + make_interval(secs => public.private_refresh_seconds(refresh_speed_level)),
      updated_at = now()
  where user_id = p_user_id and shop_type = p_shop_type;
end;
$$;

-- Re-define buy_shop_refresh_speed using the new seconds-based interval
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
      refresh_due_at = now() + make_interval(secs => public.private_refresh_seconds(refresh_speed_level + 1)),
      updated_at = now()
  where user_id = v_user_id and shop_type = p_shop_type;

  return cost;
end;
$$;
