import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const checkedRoots = ['src', 'scripts', 'tests'];
const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(absolute));
    } else if (/\.(tsx?|mjs|css)$/.test(entry.name)) {
      files.push(absolute);
    }
  }

  return files;
}

test('interface source does not contain emoji characters', () => {
  const offenders = [];
  for (const root of checkedRoots) {
    for (const file of walk(root)) {
      const text = fs.readFileSync(file, 'utf8');
      if (emojiPattern.test(text)) {
        offenders.push(file);
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test('raw meat cooking uses automatic equipment instead of a manual equipment selector', () => {
  const dashboard = fs.readFileSync('src/components/GameDashboard.tsx', 'utf8');

  assert.doesNotMatch(dashboard, /equipmentByMeat/);
  assert.doesNotMatch(dashboard, /aria-label="Cooking equipment"/);
  assert.match(dashboard, /No free equipment/);
  assert.match(dashboard, /selectBestEquipmentForRow/);
});
