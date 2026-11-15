import test from 'node:test';
import assert from 'node:assert/strict';

// The configuration boundary is JavaScript so the supported local runner can execute it directly.
const configPath = '../src/lib/supabase/env.mjs';

test('empty optional publishable key permits a valid anonymous-key configuration', async () => {
  const { readSupabaseConfig } = await import(configPath);
  assert.deepEqual(readSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ' ', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key' }), { url: 'https://project.supabase.co', anonKey: 'anon-key' });
});

test('configuration requires a valid http origin and a nonempty key', async () => {
  const { readSupabaseConfig } = await import(configPath);
  assert.equal(readSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: 'invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'key' }), null);
  assert.equal(readSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: ' ' }), null);
});

test('a configured publishable key takes precedence', async () => {
  const { readSupabaseConfig } = await import(configPath);
  assert.deepEqual(readSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co/', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon' }), { url: 'https://project.supabase.co', anonKey: 'publishable' });
});

test('currency formatting preserves cents and rounds compact values without floating point', async () => {
  const { formatCurrency } = await import('../src/lib/game/currency.mjs');
  assert.equal(formatCurrency('1234.56'), '$1,234.56');
  assert.equal(formatCurrency('1234567.89'), '$1.23M');
  assert.equal(formatCurrency('1999999.99'), '$2.00M');
  assert.equal(formatCurrency('9007199254740993.01'), '$9.01e+15');
  assert.equal(formatCurrency('1' + '0'.repeat(65) + '.99'), '$1.00e+65');
});
