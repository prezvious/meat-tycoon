import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const sql = fs
  .readdirSync('supabase/migrations')
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => fs.readFileSync(`supabase/migrations/${file}`, 'utf8'))
  .join('\n');

test('migration defines catalog and player-owned state tables', () => {
  for (const table of [
    'weight_profiles',
    'meat_items',
    'equipment_items',
    'seasoning_items',
    'player_saves',
    'meat_instances',
    'owned_equipment',
    'owned_seasoning_instances',
    'cooking_jobs',
    'shop_states',
    'shop_stock_entries',
    'sale_modifier_definitions',
    'player_sale_modifiers',
    'lifetime_statistics'
  ]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\b`));
  }
});

test('migration exposes server-authoritative gameplay RPC functions', () => {
  for (const fn of [
    'initialize_player_save',
    'resolve_time_progress',
    'buy_meat',
    'buy_equipment',
    'buy_seasoning',
    'start_cooking',
    'apply_seasoning',
    'sell_meat',
    'manual_refresh_shop',
    'buy_shop_refresh_speed',
    'buy_shop_luck',
    'sell_all_meat',
    'sell_seasoning',
    'destroy_equipment',
    'claim_sale_modifier'
  ]) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}\\b`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn.replace('_', '_')}`));
  }
});

test('migration stores time systems as absolute timestamps', () => {
  assert.match(sql, /cooking_started_at timestamptz not null/);
  assert.match(sql, /cooking_target_end_at timestamptz not null/);
  assert.match(sql, /refresh_due_at timestamptz/);
  assert.match(sql, /spoilage_started_at timestamptz/);
  assert.match(sql, /spoilage_due_at timestamptz/);
  assert.match(sql, /interval '3 days'/);
});

test('migration stores cooking time, speed, and long-cook reward snapshots', () => {
  assert.match(sql, /default_weight_kg numeric\(60, 4\)/);
  assert.match(sql, /default_cooked_seconds integer not null default 30/);
  assert.match(sql, /default_well_cooked_seconds integer not null default 60/);
  assert.match(sql, /default_perfectly_cooked_seconds integer not null default 180/);
  assert.match(sql, /legendary_cooking_eligible boolean not null default false/);
  assert.match(sql, /cooking_speed_multiplier numeric\(8, 4\) not null default 1/);
  assert.match(sql, /long_cook_multiplier_snapshot numeric\(8, 4\) not null default 1/);
  assert.match(sql, /default_cooking_seconds_snapshot integer not null default 60/);
  assert.match(sql, /pre_equipment_cooking_seconds_snapshot integer not null default 60/);
  assert.match(sql, /equipment_speed_multiplier_snapshot numeric\(8, 4\) not null default 1/);
});

test('migration stores design-aligned catalog and shop formulas', () => {
  assert.match(sql, /body_min_kg numeric/);
  assert.match(sql, /body_max_kg numeric/);
  assert.match(sql, /category_multiplier numeric/);
  assert.match(sql, /Price Penalty Modifier|private_stage_reference_price/);
  assert.match(sql, /private_luck_modifier/);
  assert.match(sql, /private_manual_refresh_cost/);
  assert.match(sql, /private_active_sale_multiplier/);
});

test('migration enforces the new global weight and sale rules', () => {
  assert.match(sql, /alter column spawned_weight type numeric\(60, 2\)/);
  assert.match(sql, /create or replace function public\.private_weight_rarity_label/);
  assert.match(sql, /when p_weight >= 100000000 then 'impossible'/);
  assert.match(sql, /spawned_weight := round\(greatest\(1\.00, roll_weight\), 2\)/);
  assert.match(sql, /create or replace function public\.private_is_saleable_cooked_state/);
  assert.match(sql, /p_state in \('cooked', 'well_cooked', 'perfectly_cooked'\)/);
  assert.match(sql, /if not public\.private_is_saleable_cooked_state\(p_target_cooking_state\) then/);
  assert.match(sql, /sqrt\(greatest\(meat\.spawned_weight, 1\.00\)\)/);
  assert.match(sql, /raise exception 'Meat must be cooked before selling'/);
  assert.match(sql, /delete from public\.shop_stock_entries\s+where shop_type = 'meat'/);
});

test('migration applies server-authoritative cooking speed and long-cook rewards', () => {
  assert.match(sql, /if p_target_cooking_state not in \('cooked', 'well_cooked', 'perfectly_cooked'\) then/);
  assert.match(sql, /power\(greatest\(meat\.spawned_weight, 1\.00\) \/ greatest\(coalesce\(meat\.default_weight_kg, 1\), 1\), 0\.75\)/);
  assert.match(sql, /equipment_speed := least\(2, greatest\(1, coalesce\(equipment\.cooking_speed_multiplier, 1\)\)\)/);
  assert.match(sql, /duration_seconds := least\(43200, greatest\(15, round\(pre_equipment_seconds \/ equipment_speed\)::integer\)\)/);
  assert.match(sql, /when default_seconds < 21600 then 1/);
  assert.match(sql, /long_cook_multiplier := greatest\(1, coalesce\(meat\.long_cook_multiplier_snapshot, 1\)\)/);
  assert.match(sql, /seasoning_multiplier \* long_cook_multiplier \* sale_modifier/);
});

test('migration finishes existing active cooking jobs as perfect without a long-cook bonus', () => {
  assert.match(sql, /where cooking_completed = false/);
  assert.match(sql, /current_cooking_state = 'perfectly_cooked'/);
  assert.match(sql, /target_cooking_state = 'perfectly_cooked'/);
  assert.match(sql, /long_cook_multiplier_snapshot = 1/);
});

test('player-owned tables have row level security enabled', () => {
  for (const table of [
    'player_saves',
    'owned_equipment',
    'owned_seasoning_instances',
    'meat_instances',
    'cooking_jobs',
    'shop_states',
    'shop_stock_entries',
    'player_sale_modifiers'
  ]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }
});
