-- Remove seasoning cap in sale calculation
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

  -- Remove seasoning cap: seasoning_multiplier is now just stacked_seasoning
  seasoning_multiplier := stacked_seasoning;
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
