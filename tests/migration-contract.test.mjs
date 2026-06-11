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
