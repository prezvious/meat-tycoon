-- Repair audited gameplay contracts. Apply the complete migration atomically.
begin;

alter table public.player_saves
  alter column balance type numeric,
  alter column lifetime_earned type numeric,
  alter column lifetime_spent type numeric;

alter table public.lifetime_statistics
  alter column total_money_spent_on_meat type numeric,
  alter column total_money_spent_on_equipment type numeric,
  alter column total_money_spent_on_seasoning type numeric,
  alter column total_money_earned_from_sales type numeric,
  alter column best_sale_value type numeric,
  alter column highest_balance_reached type numeric,
  alter column largest_single_profit type numeric;

alter table public.meat_instances
  alter column final_sell_value type numeric;

alter table public.owned_seasoning_instances add column sold_at timestamptz;

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
  applied_multiplier numeric;
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
    for applied_multiplier in
      select greatest(effective_multiplier, 1)
      from public.meat_applied_seasonings
      where meat_instance_id = meat.id
      order by applied_at, id
    loop
      stacked_seasoning := stacked_seasoning * applied_multiplier;
    end loop;
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

create or replace function public.private_active_sale_multiplier(p_user_id uuid)
returns numeric
language plpgsql stable
set search_path = public
as $$
declare
  factor numeric;
  product numeric := 1;
begin
  for factor in
    select multiplier from public.player_sale_modifiers
    where user_id = p_user_id and active
      and (expires_at is null or now() < expires_at)
    order by id
  loop
    product := product * factor;
  end loop;
  return product;
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
    and osi.sold_at is null
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

  update public.owned_seasoning_instances
  set sold_at = now()
  where id = p_seasoning_instance_id;

  update public.player_saves
  set balance = balance + payout,
      lifetime_earned = lifetime_earned + payout,
      last_saved_at = now()
  where user_id = v_user_id;

  return payout;
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

  if meat.current_cooking_state not in ('cooked', 'well_cooked', 'perfectly_cooked') then
    raise exception 'Seasoning can only be applied to cooked, well cooked, or perfectly cooked meat';
  end if;

  select * into seasoning_instance
  from public.owned_seasoning_instances
  where id = p_seasoning_instance_id
    and user_id = v_user_id
    and sold_at is null
  for update;

  if seasoning_instance is null or seasoning_instance.remaining_uses <= 0 then
    raise exception 'Seasoning is not usable';
  end if;

  select * into seasoning from public.seasoning_items where id = seasoning_instance.seasoning_item_id;

  select count(*) into applied_count
  from public.meat_applied_seasonings
  where meat_instance_id = meat.id;

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

  -- Reject a reward outside native numeric capacity before any debit commits.
  perform public.private_calculate_sale_value(meat.id);

  update public.owned_seasoning_instances
  set remaining_uses = greatest(0, remaining_uses - durability_loss)
  where id = seasoning_instance.id;

  update public.lifetime_statistics
  set total_seasonings_applied = total_seasonings_applied + 1,
      updated_at = now()
  where user_id = v_user_id;
end;
$$;

create or replace function public.season_all_cooked_meat()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.private_current_user_id();
  meat record;
  seasoning_inst record;
  compatibility record;
  applied_count integer;
  slot_strength numeric;
  durability_strength numeric;
  durability_loss integer;
  total_applied integer := 0;
begin
  perform public.initialize_player_save();
  perform public.resolve_time_progress();

  if v_user_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Authentication required';
  end if;

  -- Loop through all ready-to-sell meats, prioritized by value (highest first)
  for meat in
    select mi.*
    from public.meat_instances mi
    join public.meat_items item on item.id = mi.meat_item_id
    where mi.user_id = v_user_id
      and mi.sold_at is null
      and mi.current_cooking_state in ('cooked', 'well_cooked', 'perfectly_cooked')
    order by (mi.spawned_weight * mi.base_meat_value_snapshot * item.category_multiplier) desc
  loop

    -- Loop through all owned seasonings that still have remaining uses
    -- and have not been applied to this specific meat yet.
    -- Order them by base_multiplier desc (best seasonings first)
    for seasoning_inst in
      select osi.*, si.base_multiplier, si.id as seasoning_item_id
      from public.owned_seasoning_instances osi
      join public.seasoning_items si on si.id = osi.seasoning_item_id
      where osi.user_id = v_user_id
        and osi.remaining_uses > 0
        and osi.sold_at is null
        and not exists (
          select 1
          from public.meat_applied_seasonings mas
          where mas.meat_instance_id = meat.id
            and mas.seasoning_instance_id = osi.id
        )
      order by si.base_multiplier desc, osi.remaining_uses desc
    loop

      -- Re-verify remaining uses of seasoning_inst because it might have been updated in this transaction
      declare
        v_current_uses integer;
      begin
        select remaining_uses into v_current_uses
        from public.owned_seasoning_instances
        where id = seasoning_inst.id;

        if v_current_uses > 0 then
          -- Get current number of seasonings applied to this meat
          select count(*) into applied_count
          from public.meat_applied_seasonings
          where meat_instance_id = meat.id;

          -- Check compatibility
          select * into compatibility
          from public.private_seasoning_compatibility(meat.meat_item_id, meat.selected_equipment_item_id, seasoning_inst.seasoning_item_id);

          slot_strength := case applied_count + 1
            when 1 then 1
            when 2 then 1
            when 3 then 1
            when 4 then 0.75
            when 5 then 0.50
            else 0.25
          end;

          durability_strength := case
            when v_current_uses::numeric / seasoning_inst.maximum_uses <= 0.10 then 0.75
            when v_current_uses::numeric / seasoning_inst.maximum_uses <= 0.30 then 0.90
            else 1
          end;
          durability_loss := case when compatibility.match_level = 'bad' then 2 else 1 end;

          -- Apply the seasoning!
          insert into public.meat_applied_seasonings (
            user_id,
            meat_instance_id,
            seasoning_instance_id,
            effective_multiplier
          )
          values (
            v_user_id,
            meat.id,
            seasoning_inst.id,
            greatest(1, 1 + ((seasoning_inst.base_multiplier - 1) * slot_strength * durability_strength * compatibility.strength))
          );

          perform public.private_calculate_sale_value(meat.id);

          -- Update remaining uses (respecting bad compatibility loss = 2)
          update public.owned_seasoning_instances
          set remaining_uses = greatest(0, remaining_uses - durability_loss)
          where id = seasoning_inst.id;

          total_applied := total_applied + 1;
        end if;
      end;

    end loop;
  end loop;

  if total_applied > 0 then
    update public.lifetime_statistics
    set total_seasonings_applied = total_seasonings_applied + total_applied,
        updated_at = now()
    where user_id = v_user_id;
  end if;

  return total_applied;
end;
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
    when 'common' then 0.10
    when 'uncommon' then 0.30
    when 'rare' then 0.50
    when 'epic' then 0.70
    when 'legendary' then 0.85
    when 'mythic' then 1.00
    when 'jackpot rare' then 1.20
    else 0.50
  end;
  luck_multiplier := 1 + (0.9 * greatest(0, p_luck_level));
  return 1 + ((luck_multiplier - 1) * sensitivity);
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
  if v_user_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Authentication required';
  end if;

  perform 1 from public.player_saves where user_id = v_user_id for update;

  with completed as (
    update public.cooking_jobs cj
    set cooking_completed = true,
        cooking_completed_at = cj.cooking_target_end_at
    where cj.user_id = v_user_id
      and cj.cooking_completed = false
      and now() >= cj.cooking_target_end_at
    returning cj.*
  )
  update public.meat_instances mi
  set current_cooking_state = cj.target_cooking_state,
      selected_equipment_item_id = cj.equipment_item_id,
      spoilage_started_at = cj.cooking_target_end_at,
      spoilage_due_at = cj.cooking_target_end_at + interval '3 days'
  from completed cj
  where mi.id = cj.meat_instance_id
    and mi.user_id = v_user_id
    and mi.sold_at is null
    and mi.current_cooking_state = 'cooking';

  update public.player_sale_modifiers
  set active = false
  where user_id = v_user_id and active = true
    and expires_at is not null and expires_at <= now();

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

create or replace function public.private_game_row(p_row jsonb)
returns jsonb
language sql immutable
set search_path = pg_catalog
as $$
  select coalesce(jsonb_object_agg(key,
    case when jsonb_typeof(value) = 'number' then to_jsonb(value #>> '{}') else value end
  ), '{}'::jsonb)
  from jsonb_each(p_row);
$$;

create or replace function public.get_game_state()
returns jsonb
language plpgsql stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := public.private_current_user_id();
  result jsonb;
begin
  if v_user_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Authentication required';
  end if;
  if not exists (select 1 from public.player_saves where user_id = v_user_id) then
    raise exception 'Player save is not initialized';
  end if;

  select jsonb_build_object(
    'version', 1,
    'save', (select public.private_game_row(to_jsonb(ps)) from public.player_saves ps where ps.user_id = v_user_id),
    'stats', (select public.private_game_row(to_jsonb(ls)) from public.lifetime_statistics ls where ls.user_id = v_user_id),
    'meats', (select coalesce(jsonb_agg(public.private_game_row(to_jsonb(item)) order by item.shop_stage, item.purchase_price, item.id), '[]'::jsonb) from public.meat_items item where item.enabled),
    'equipment', (select coalesce(jsonb_agg(public.private_game_row(to_jsonb(item)) order by item.purchase_price, item.id), '[]'::jsonb) from public.equipment_items item where item.enabled),
    'seasonings', (select coalesce(jsonb_agg(public.private_game_row(to_jsonb(item)) order by item.purchase_price, item.id), '[]'::jsonb) from public.seasoning_items item where item.enabled),
    'meatStock', (select coalesce(jsonb_agg(public.private_game_row(to_jsonb(stock)) order by stock.id), '[]'::jsonb) from public.shop_stock_entries stock where stock.user_id = v_user_id and stock.shop_type = 'meat'),
    'seasoningStock', (select coalesce(jsonb_agg(public.private_game_row(to_jsonb(stock)) order by stock.id), '[]'::jsonb) from public.shop_stock_entries stock where stock.user_id = v_user_id and stock.shop_type = 'seasoning'),
    'shopStates', (select coalesce(jsonb_agg(public.private_game_row(to_jsonb(shop)) order by shop.shop_type), '[]'::jsonb) from public.shop_states shop where shop.user_id = v_user_id),
    'saleModifierDefinitions', (select coalesce(jsonb_agg(public.private_game_row(to_jsonb(modifier)) order by modifier.id), '[]'::jsonb) from public.sale_modifier_definitions modifier where modifier.enabled),
    'activeSaleModifiers', (select coalesce(jsonb_agg(public.private_game_row(to_jsonb(modifier)) order by modifier.id), '[]'::jsonb) from public.player_sale_modifiers modifier where modifier.user_id = v_user_id and modifier.active and (modifier.expires_at is null or modifier.expires_at > now())),
    'ownedMeats', (
      select coalesce(jsonb_agg(
        public.private_game_row(to_jsonb(mi)) || jsonb_build_object(
          'meat_items', public.private_game_row(to_jsonb(item)),
          'applied_seasonings', (select coalesce(jsonb_agg(jsonb_build_object(
            'seasoning_instance_id', mas.seasoning_instance_id,
            'effectiveMultiplier', mas.effective_multiplier::text
          ) order by mas.applied_at, mas.id), '[]'::jsonb) from public.meat_applied_seasonings mas where mas.meat_instance_id = mi.id and mas.user_id = v_user_id)
        ) order by mi.created_at desc, mi.id desc
      ), '[]'::jsonb)
      from public.meat_instances mi join public.meat_items item on item.id = mi.meat_item_id
      where mi.user_id = v_user_id and mi.sold_at is null
    ),
    'ownedEquipment', (
      select coalesce(jsonb_agg(public.private_game_row(to_jsonb(oe)) || jsonb_build_object('equipment_items', public.private_game_row(to_jsonb(item))) order by oe.equipment_item_id), '[]'::jsonb)
      from public.owned_equipment oe join public.equipment_items item on item.id = oe.equipment_item_id
      where oe.user_id = v_user_id
    ),
    'ownedSeasonings', (
      select coalesce(jsonb_agg(public.private_game_row(to_jsonb(osi)) || jsonb_build_object('seasoning_items', public.private_game_row(to_jsonb(item))) order by osi.acquired_at, osi.id), '[]'::jsonb)
      from public.owned_seasoning_instances osi join public.seasoning_items item on item.id = osi.seasoning_item_id
      where osi.user_id = v_user_id and osi.sold_at is null and osi.remaining_uses > 0
    ),
    'cookingJobs', (
      select coalesce(jsonb_agg(public.private_game_row(to_jsonb(cj)) || jsonb_build_object(
        'meat_instances', jsonb_build_object('meat_items', jsonb_build_object('display_name', item.display_name)),
        'equipment_items', jsonb_build_object('display_name', equipment.display_name)
      ) order by cj.cooking_target_end_at, cj.id), '[]'::jsonb)
      from public.cooking_jobs cj
      join public.meat_instances mi on mi.id = cj.meat_instance_id
      join public.meat_items item on item.id = mi.meat_item_id
      join public.equipment_items equipment on equipment.id = cj.equipment_item_id
      where cj.user_id = v_user_id and cj.cooking_completed = false
    )
  ) into result;
  return result;
end;
$$;

-- Internal functions have no API execution rights, including inherited PUBLIC rights.
do $$
declare
  helper regprocedure;
  entry_point regprocedure;
begin
  for helper in
    select p.oid::regprocedure from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and starts_with(p.proname, 'private_')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', helper);
  end loop;

  foreach entry_point in array array[
    'public.initialize_player_save()'::regprocedure,
    'public.resolve_time_progress()'::regprocedure,
    'public.buy_meat(text)'::regprocedure,
    'public.buy_equipment(text)'::regprocedure,
    'public.buy_seasoning(text)'::regprocedure,
    'public.start_cooking(uuid,text,text)'::regprocedure,
    'public.apply_seasoning(uuid,uuid)'::regprocedure,
    'public.sell_meat(uuid)'::regprocedure,
    'public.sell_all_meat()'::regprocedure,
    'public.season_all_cooked_meat()'::regprocedure,
    'public.manual_refresh_shop(text)'::regprocedure,
    'public.buy_shop_refresh_speed(text)'::regprocedure,
    'public.buy_shop_luck(text)'::regprocedure,
    'public.sell_seasoning(uuid)'::regprocedure,
    'public.destroy_equipment(text)'::regprocedure,
    'public.claim_sale_modifier(text)'::regprocedure,
    'public.get_game_state()'::regprocedure
  ]
  loop
    execute format('revoke execute on function %s from public, anon', entry_point);
    execute format('grant execute on function %s to authenticated', entry_point);
  end loop;
end;
$$;

commit;
