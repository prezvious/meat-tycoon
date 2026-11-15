import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

function exportCatalog(args) {
  return spawnSync(process.execPath, ['scripts/seed-catalog.mjs', ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      COOKING_TIMING_SEED: 'meat-tycoon-catalog-v1'
    }
  });
}

test('SQL export includes the complete catalog without credentials or the Supabase SDK', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meat-tycoon-seed-'));
  const output = path.join(directory, 'seed.sql');
  try {
    const result = exportCatalog(['--sql', output]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).counts, {
      meats: 237,
      equipment: 194,
      seasonings: 120,
      weightProfiles: 30
    });
    assert.equal(JSON.parse(result.stdout).status, 'exported');
    const sql = fs.readFileSync(output, 'utf8');
    for (const table of ['weight_profiles', 'meat_items', 'equipment_items', 'seasoning_items']) {
      assert.ok(sql.includes(`insert into public.${table} (`));
    }
    assert.ok(sql.includes("'Chicken Feet'"));
    assert.ok(sql.includes("'Countertop Oven'"));
    assert.ok(sql.includes('on conflict (id) do update'));
    assert.ok(sql.includes('\nbegin;\n'));
    assert.ok(sql.endsWith('commit;\n'));

    const repeated = exportCatalog(['--sql', output]);
    assert.equal(repeated.status, 0, repeated.stderr);
    assert.equal(fs.readFileSync(output, 'utf8'), sql);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('SQL export requires an output path', () => {
  const result = exportCatalog(['--sql']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--sql requires an output file path/);
});
