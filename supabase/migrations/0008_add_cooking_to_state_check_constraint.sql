-- Drop the existing check constraint on meat_instances
alter table public.meat_instances
  drop constraint if exists meat_instances_current_cooking_state_check;

-- Recreate the check constraint to include 'cooking'
alter table public.meat_instances
  add constraint meat_instances_current_cooking_state_check
  check (
    current_cooking_state in (
      'raw',
      'cooking',
      'undercooked',
      'cooked',
      'well_cooked',
      'perfectly_cooked',
      'overcooked',
      'burnt',
      'spoiled'
    )
  );
