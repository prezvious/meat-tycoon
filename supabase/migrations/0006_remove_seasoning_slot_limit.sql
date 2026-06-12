-- Remove seasoning slot limit in apply_seasoning
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

  update public.owned_seasoning_instances
  set remaining_uses = greatest(0, remaining_uses - durability_loss)
  where id = seasoning_instance.id;

  update public.lifetime_statistics
  set total_seasonings_applied = total_seasonings_applied + 1,
      updated_at = now()
  where user_id = v_user_id;
end;
$$;
