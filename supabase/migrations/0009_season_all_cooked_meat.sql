-- Add season_all_cooked_meat function
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

grant execute on function public.season_all_cooked_meat() to authenticated;
