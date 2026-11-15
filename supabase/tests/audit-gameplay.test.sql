-- Non-security regression tests for an already migrated, seeded local database.
-- Do not run against a hosted/shared project. The transaction rolls back all fixtures.
begin;
do $$
declare
  player_id uuid := gen_random_uuid();
  raw_id uuid;
  cooked_id uuid;
  seasoning_id uuid;
  job_meat_id uuid;
  reward numeric;
  expected_reward numeric := 30;
  state jsonb;
  old_tuple text;
  new_tuple text;
  applied_before integer;
begin
  insert into auth.users (id, is_anonymous) values (player_id, true);
  perform set_config('request.jwt.claim.sub', player_id::text, true);
  perform public.initialize_player_save();

  for i in 1..41 loop
    insert into public.meat_instances (user_id, meat_item_id, purchase_price_paid, spawned_weight, base_meat_value_snapshot)
    values (player_id, 'chicken_feet', 25, 1, 2) returning id into raw_id;
  end loop;
  state := public.get_game_state();
  if jsonb_array_length(state->'ownedMeats') is distinct from 41 then
    raise exception 'Inventory beyond 40 rows was truncated';
  end if;
  if jsonb_typeof(state->'save'->'balance') is distinct from 'string' then
    raise exception 'Currency was transported as a JSON number';
  end if;

  insert into public.meat_instances (user_id, meat_item_id, purchase_price_paid, spawned_weight, base_meat_value_snapshot, current_cooking_state, selected_equipment_item_id)
  values (player_id, 'chicken_feet', 25, 1, 2, 'perfectly_cooked', 'countertop_oven') returning id into cooked_id;
  for i in 1..7 loop
    insert into public.owned_seasoning_instances (user_id, seasoning_item_id, remaining_uses, maximum_uses)
    values (player_id, 'full_flavor_infusion_line', 1, 1) returning id into seasoning_id;
    perform public.apply_seasoning(cooked_id, seasoning_id);
    expected_reward := expected_reward * (1 + (2500000000::numeric - 1) *
      case when i <= 3 then 1 when i = 4 then 0.75 when i = 5 then 0.50 else 0.25 end);
  end loop;
  reward := public.sell_meat(cooked_id);
  if reward <> round(expected_reward, 2) or reward < power(10::numeric, 58) then
    raise exception 'Large sale was lost, truncated, or calculated inexactly';
  end if;
  state := public.get_game_state();
  if (state->'save'->>'balance')::numeric is distinct from 2000 + reward then
    raise exception 'Large payout did not reach the balance intact';
  end if;

  insert into public.meat_instances (user_id, meat_item_id, purchase_price_paid, spawned_weight, base_meat_value_snapshot, current_cooking_state, selected_equipment_item_id)
  values (player_id, 'chicken_feet', 25, 1, 2, 'perfectly_cooked', 'countertop_oven') returning id into cooked_id;
  insert into public.owned_seasoning_instances (user_id, seasoning_item_id, remaining_uses, maximum_uses)
  values (player_id, 'mesquite_smoke_rub_tin', 26, 26) returning id into seasoning_id;
  perform public.apply_seasoning(cooked_id, seasoning_id);
  select count(*) into applied_before from public.meat_applied_seasonings where meat_instance_id = cooked_id;
  reward := public.private_calculate_sale_value(cooked_id);
  perform public.sell_seasoning(seasoning_id);
  if not exists (select 1 from public.owned_seasoning_instances where id = seasoning_id and sold_at is not null) then
    raise exception 'Used seasoning was not retired';
  end if;
  if (select count(*) from public.meat_applied_seasonings where meat_instance_id = cooked_id) <> applied_before
     or public.private_calculate_sale_value(cooked_id) <> reward then
    raise exception 'Sellback deleted an earned bonus';
  end if;
  state := public.get_game_state();
  if exists (select 1 from jsonb_array_elements(state->'ownedSeasonings') item where item->>'id' = seasoning_id::text) then
    raise exception 'Sold seasoning remains usable in state';
  end if;

  if public.private_luck_modifier(1, 'Mythic') / public.private_luck_modifier(1, 'Common') <= 1 then
    raise exception 'Seasoning luck does not change relative weights';
  end if;

  insert into public.meat_instances (user_id, meat_item_id, purchase_price_paid, spawned_weight, base_meat_value_snapshot, current_cooking_state, selected_equipment_item_id)
  values (player_id, 'chicken_feet', 25, 1, 2, 'cooking', 'countertop_oven') returning id into job_meat_id;
  insert into public.cooking_jobs (user_id, meat_instance_id, equipment_item_id, equipment_slot_index, cooking_started_at, cooking_target_end_at, cooking_duration_seconds, target_cooking_state)
  values (player_id, job_meat_id, 'countertop_oven', 0, now() - interval '4 days 1 minute', now() - interval '4 days', 60, 'perfectly_cooked');
  perform public.resolve_time_progress();
  select ctid::text into old_tuple from public.meat_instances where id = job_meat_id and current_cooking_state = 'spoiled';
  perform public.resolve_time_progress();
  select ctid::text into new_tuple from public.meat_instances where id = job_meat_id;
  if old_tuple is null or old_tuple <> new_tuple then
    raise exception 'Repeated resolution rewrites terminal spoiled meat';
  end if;

  perform public.claim_sale_modifier('opening_weekend');
  update public.player_sale_modifiers set expires_at = now() - interval '1 second' where user_id = player_id;
  state := public.get_game_state();
  if jsonb_array_length(state->'activeSaleModifiers') is distinct from 0 then
    raise exception 'Expired modifier is still presented as active';
  end if;
  perform public.claim_sale_modifier('opening_weekend');
  state := public.get_game_state();
  if jsonb_array_length(state->'activeSaleModifiers') is distinct from 1 then
    raise exception 'Expired modifier could not be renewed';
  end if;
end;
$$;
rollback;
