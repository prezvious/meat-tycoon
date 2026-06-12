import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateExpectedWeight,
  loadExtraMeatCookingPreview,
  loadCatalogFromDocs,
  STAGE_BREAK_EVEN_TARGETS,
  validateCatalog
} from '../src/lib/catalog/catalog-parser.mjs';
import { BELOW_LEGENDARY_COOKING_MAX_SECONDS } from '../src/lib/game/formulas.mjs';

test('catalog parser converts markdown source docs into launch data', () => {
  const catalog = loadCatalogFromDocs(process.cwd());
  const issues = validateCatalog(catalog);

  assert.deepEqual(issues, []);
  assert.ok(catalog.meats.length > 100, 'expected full meat catalog');
  assert.ok(catalog.equipment.length > 100, 'expected full equipment catalog');
  assert.ok(catalog.seasonings.length > 50, 'expected full seasoning catalog');
  assert.equal(catalog.weightProfiles.length, 30, 'expected all documented weight profiles');
});

test('starter economy essentials are present', () => {
  const catalog = loadCatalogFromDocs(process.cwd());
  const chickenFeet = catalog.meats.find((item) => item.id === 'chicken_feet');
  const countertopOven = catalog.equipment.find((item) => item.id === 'countertop_oven');

  assert.equal(chickenFeet?.purchasePrice, '25.00');
  assert.equal(chickenFeet?.starterOnly, true);
  assert.equal(countertopOven?.purchasePrice, '0.00');
  assert.equal(countertopOven?.priceMultiplier, 1.1);
  assert.ok(countertopOven?.cookingSpeedMultiplier >= 1);
  assert.ok(countertopOven?.cookingSpeedMultiplier <= 2);
  assert.equal(countertopOven?.cookingSlotCount, 1);
});

test('seasonings use durability but never expiration', () => {
  const catalog = loadCatalogFromDocs(process.cwd());

  assert.ok(catalog.seasonings.length > 0);
  assert.equal(catalog.seasonings.every((seasoning) => seasoning.expires === false), true);
});

test('meat catalog uses documented weight profile assignments', () => {
  const catalog = loadCatalogFromDocs(process.cwd());
  const byId = new Map(catalog.meats.map((item) => [item.id, item]));

  assert.equal(byId.get('a5_japanese_kobe_beef')?.weightProfileId, 'luxury_small_medium_high_variance');
  assert.equal(byId.get('a5_japanese_wagyu_beef')?.weightProfileId, 'luxury_small_medium_high_variance');
  assert.equal(byId.get('ribeye_steak')?.weightProfileId, 'premium_steak_cut');
  assert.equal(byId.get('beef_brisket')?.weightProfileId, 'heavy_roast_cut');
});

test('meat tiers map to six shop stages from the design docs', () => {
  const catalog = loadCatalogFromDocs(process.cwd());
  const stageByTier = new Map();
  for (const meat of catalog.meats) {
    if (!stageByTier.has(meat.accessTier)) {
      stageByTier.set(meat.accessTier, meat.shopStage);
    }
  }

  assert.equal(stageByTier.get('Starter'), 1);
  assert.equal(stageByTier.get('Starter-Adjacent'), 2);
  assert.equal(stageByTier.get('Basic'), 2);
  assert.equal(stageByTier.get('Common Upgrade'), 3);
  assert.equal(stageByTier.get('Specialty'), 4);
  assert.equal(stageByTier.get('Luxury'), 5);
  assert.equal(stageByTier.get('Extreme Luxury'), 6);
});

test('weight profiles expose concrete roll parameters', () => {
  const catalog = loadCatalogFromDocs(process.cwd());
  const byId = new Map(catalog.weightProfiles.map((item) => [item.id, item]));

  assert.equal(byId.get('tiny_part_jackpot_possible')?.bodyMinKg, 1);
  assert.equal(byId.get('tiny_part_jackpot_possible')?.bodyMaxKg, 3);
  assert.equal(byId.get('heavy_roast_cut')?.bodyMaxKg, 8);
  assert.equal(byId.get('luxury_small_medium_high_variance')?.tailAnchorKg, 50000);
  assert.equal(byId.get('luxury_small_medium_high_variance')?.tailChance, 0.00001);
});

test('runtime weight profiles enforce the global one kilogram floor', () => {
  const catalog = loadCatalogFromDocs(process.cwd());

  for (const profile of catalog.weightProfiles) {
    assert.ok(profile.bodyMinKg >= 1, `${profile.id} body minimum should be at least 1 kg`);
    assert.ok(profile.bodyMaxKg > profile.bodyMinKg, `${profile.id} body range should remain variable`);
    assert.ok(profile.tailAnchorKg >= 1, `${profile.id} tail anchor should be at least 1 kg`);
  }
});

test('runtime base values meet stage break-even targets on expected weight', () => {
  const catalog = loadCatalogFromDocs(process.cwd());
  const profileById = new Map(catalog.weightProfiles.map((profile) => [profile.id, profile]));

  for (const meat of catalog.meats) {
    const profile = profileById.get(meat.weightProfileId);
    const expectedWeight = calculateExpectedWeight(profile);
    const target = STAGE_BREAK_EVEN_TARGETS[meat.shopStage];
    const expectedSaleStrength = Number(meat.baseMeatValue) * expectedWeight * target;

    assert.ok(
      expectedSaleStrength + 0.01 >= Number(meat.purchasePrice),
      `${meat.id} should meet Stage ${meat.shopStage} break-even target`
    );
  }
});

test('live meat catalog includes generated default cooking times', () => {
  const catalog = loadCatalogFromDocs(process.cwd(), { cookingTimingSeed: 'catalog-test' });

  for (const meat of catalog.meats) {
    assert.ok(meat.defaultWeightKg >= 1, `${meat.id} should have a default timing weight`);
    assert.ok(meat.defaultCookedSeconds >= 30, `${meat.id} should have cooked seconds`);
    assert.ok(
      meat.defaultCookedSeconds < meat.defaultWellCookedSeconds,
      `${meat.id} cooked time should be below well-cooked time`
    );
    assert.ok(
      meat.defaultWellCookedSeconds < meat.defaultPerfectlyCookedSeconds,
      `${meat.id} well-cooked time should be below perfectly-cooked time`
    );

    if (!meat.legendaryCookingEligible) {
      assert.ok(
        meat.defaultPerfectlyCookedSeconds <= BELOW_LEGENDARY_COOKING_MAX_SECONDS,
        `${meat.id} below-legendary timing should cap at two hours`
      );
    }
  }
});

test('cooking timing generation is reproducible for the same seed', () => {
  const first = loadCatalogFromDocs(process.cwd(), { cookingTimingSeed: 'repeatable-seed' });
  const second = loadCatalogFromDocs(process.cwd(), { cookingTimingSeed: 'repeatable-seed' });
  const firstMeat = first.meats.find((meat) => meat.id === 'a5_japanese_kobe_beef');
  const secondMeat = second.meats.find((meat) => meat.id === 'a5_japanese_kobe_beef');

  assert.equal(firstMeat?.defaultPerfectlyCookedSeconds, secondMeat?.defaultPerfectlyCookedSeconds);
});

test('extra meat lists produce non-playable cooking preview rows with suffixed duplicates', () => {
  const preview = loadExtraMeatCookingPreview(process.cwd(), { cookingTimingSeed: 'extra-preview-test' });
  const ids = new Set(preview.map((row) => row.id));

  assert.equal(preview.length, 432);
  assert.equal(ids.size, preview.length);
  assert.ok(ids.has('sage_breakfast_sausage_roll'));
  assert.ok(ids.has('sage_breakfast_sausage_roll_2'));
  assert.equal(preview.every((row) => row.enabled === false), true);
  assert.equal(preview.every((row) => row.defaultWeightKg >= 1), true);
});
