import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BELOW_LEGENDARY_COOKING_MAX_SECONDS,
  calculateCookingDuration,
  calculateDurabilityStrength,
  calculateEquipmentCookingSpeedMultiplier,
  calculateLongCookMultiplier,
  calculateSaleValue,
  calculateSeasoningMultiplier,
  calculateSeasoningSlotStrength,
  createSeededRandom,
  formatWeightKg,
  generateDefaultCookingTimes,
  inferCookingDurationSeconds
} from '../src/lib/game/formulas.mjs';

test('sale formula applies weight, cooking, equipment, seasoning cap, and rounding in order', () => {
  const result = calculateSaleValue({
    spawnedWeight: 10,
    baseMeatValue: 5,
    cookingState: 'perfectly_cooked',
    equipmentMultiplier: 2,
    seasonings: [
      {
        baseMultiplier: 10,
        remainingUses: 5,
        maximumUses: 5,
        compatibilityStrength: 1.5
      }
    ]
  });

  assert.equal(result.finalSeasoningMultiplier, 14.5, 'seasoning must not be capped by equipment');
  assert.equal(result.finalSellingPrice, '4402.20');
});

test('sale formula applies locked long-cook multiplier', () => {
  const result = calculateSaleValue({
    spawnedWeight: 10,
    baseMeatValue: 5,
    cookingState: 'perfectly_cooked',
    equipmentMultiplier: 2,
    longCookMultiplier: 2,
    seasonings: [
      {
        baseMultiplier: 10,
        remainingUses: 5,
        maximumUses: 5,
        compatibilityStrength: 1.5
      }
    ]
  });

  assert.equal(result.longCookMultiplier, 2);
  assert.equal(result.finalSellingPrice, '8804.40');
});

test('durability strength follows seasoning durability tiers', () => {
  assert.equal(calculateDurabilityStrength(10, 10), 1);
  assert.equal(calculateDurabilityStrength(3, 10), 0.9);
  assert.equal(calculateDurabilityStrength(1, 10), 0.75);
  assert.equal(calculateDurabilityStrength(0, 10), 0);
});

test('seasoning slot strength follows documented stepped diminishing returns', () => {
  assert.equal(calculateSeasoningSlotStrength(0), 1);
  assert.equal(calculateSeasoningSlotStrength(2), 1);
  assert.equal(calculateSeasoningSlotStrength(3), 0.75);
  assert.equal(calculateSeasoningSlotStrength(4), 0.5);
  assert.equal(calculateSeasoningSlotStrength(5), 0.25);
});

test('seasoning compatibility affects bonus before equipment cap', () => {
  const result = calculateSeasoningMultiplier(
    [
      { baseMultiplier: 2, remainingUses: 10, maximumUses: 10, compatibilityStrength: 1 },
      { baseMultiplier: 2, remainingUses: 10, maximumUses: 10, compatibilityStrength: 1 },
      { baseMultiplier: 2, remainingUses: 10, maximumUses: 10, compatibilityStrength: 1 },
      { baseMultiplier: 2, remainingUses: 10, maximumUses: 10, compatibilityStrength: 1.5 }
    ]
  );

  assert.equal(result, 2 * 2 * 2 * 2.125);
});

test('no seasonings produce neutral multiplier', () => {
  assert.equal(calculateSeasoningMultiplier([]), 1);
});

test('cooked sale formula floors non-penalty sales above purchase price', () => {
  const result = calculateSaleValue({
    spawnedWeight: 1,
    baseMeatValue: 0.01,
    cookingState: 'cooked',
    equipmentMultiplier: 1,
    purchasePricePaid: 100,
    seasonings: []
  });

  assert.equal(result.saleFloorValue, '105.00');
  assert.equal(result.finalSellingPrice, '105.00');
});

test('value-slashing equipment can reduce the cooked profit floor', () => {
  const result = calculateSaleValue({
    spawnedWeight: 1,
    baseMeatValue: 0.01,
    cookingState: 'cooked',
    equipmentMultiplier: 0.5,
    purchasePricePaid: 100,
    seasonings: []
  });

  assert.equal(result.saleFloorValue, '52.50');
  assert.equal(result.finalSellingPrice, '52.50');
});

test('weight formatter uses integer, decimal, and named large-number labels', () => {
  assert.equal(formatWeightKg(1), '1 kg');
  assert.equal(formatWeightKg(1.25), '1.25 kg');
  assert.equal(formatWeightKg(1_000_000_000), '1 billion kg');
  assert.equal(formatWeightKg(2_500_000_000_000), '2.50 trillion kg');
});

test('generated cooking times are ordered and cap below-legendary meats at two hours', () => {
  const random = createSeededRandom('test-below-legendary');
  const times = generateDefaultCookingTimes(
    {
      defaultWeightKg: 3,
      baseMeatValue: 1200,
      rarityClass: 'Rare',
      meatTags: ['slow_cook', 'smoked', 'whole_cut']
    },
    random
  );

  assert.equal(times.legendaryCookingEligible, false);
  assert.ok(times.defaultCookedSeconds >= 30);
  assert.ok(times.defaultCookedSeconds < times.defaultWellCookedSeconds);
  assert.ok(times.defaultWellCookedSeconds < times.defaultPerfectlyCookedSeconds);
  assert.ok(times.defaultPerfectlyCookedSeconds <= BELOW_LEGENDARY_COOKING_MAX_SECONDS);
});

test('generated cooking times allow legendary meats to exceed two hours', () => {
  const random = createSeededRandom('test-legendary');
  const times = generateDefaultCookingTimes(
    {
      defaultWeightKg: 2.5,
      baseMeatValue: 250000,
      rarityClass: 'Extreme Luxury',
      meatTags: ['luxury', 'premium_cut']
    },
    random
  );

  assert.equal(times.legendaryCookingEligible, true);
  assert.ok(times.defaultPerfectlyCookedSeconds > BELOW_LEGENDARY_COOKING_MAX_SECONDS);
  assert.ok(times.defaultPerfectlyCookedSeconds <= 24 * 60 * 60);
});

test('cooking duration applies strong roll weight and equipment speed caps', () => {
  const light = calculateCookingDuration({
    targetCookingState: 'perfectly_cooked',
    spawnedWeight: 1,
    defaultWeightKg: 4,
    defaultPerfectlyCookedSeconds: 7200,
    legendaryCookingEligible: false,
    cookingSpeedMultiplier: 1
  });
  const heavy = calculateCookingDuration({
    targetCookingState: 'perfectly_cooked',
    spawnedWeight: 64,
    defaultWeightKg: 4,
    defaultPerfectlyCookedSeconds: 7200,
    legendaryCookingEligible: false,
    cookingSpeedMultiplier: 1
  });
  const fast = calculateCookingDuration({
    targetCookingState: 'perfectly_cooked',
    spawnedWeight: 64,
    defaultWeightKg: 4,
    defaultPerfectlyCookedSeconds: 7200,
    legendaryCookingEligible: true,
    cookingSpeedMultiplier: 2
  });

  assert.ok(heavy.durationSeconds > light.durationSeconds);
  assert.equal(heavy.preEquipmentSeconds, BELOW_LEGENDARY_COOKING_MAX_SECONDS);
  assert.equal(fast.equipmentSpeedMultiplier, 2);
  assert.equal(fast.durationSeconds, Math.round(fast.preEquipmentSeconds / 2));
});

test('cooking duration clamps equipment-adjusted final time to gameplay bounds', () => {
  assert.equal(
    calculateCookingDuration({
      targetCookingState: 'cooked',
      spawnedWeight: 1,
      defaultWeightKg: 100,
      defaultCookedSeconds: 30,
      cookingSpeedMultiplier: 2
    }).durationSeconds,
    15
  );

  assert.equal(
    calculateCookingDuration({
      targetCookingState: 'perfectly_cooked',
      spawnedWeight: 100000,
      defaultWeightKg: 1,
      defaultPerfectlyCookedSeconds: 86400,
      legendaryCookingEligible: true,
      cookingSpeedMultiplier: 1
    }).durationSeconds,
    12 * 60 * 60
  );
});

test('long-cook multiplier starts at six hours and caps at ten times', () => {
  assert.equal(calculateLongCookMultiplier((6 * 60 * 60) - 1), 1);
  assert.equal(calculateLongCookMultiplier(6 * 60 * 60), 1);
  assert.equal(calculateLongCookMultiplier(24 * 60 * 60), 10);
  assert.equal(calculateLongCookMultiplier(48 * 60 * 60), 10);
});

test('equipment cooking speed is type-based and capped at two times', () => {
  assert.equal(
    calculateEquipmentCookingSpeedMultiplier({
      equipmentType: 'Steamers & Pressure Cookers',
      purchasePrice: 500000000000000
    }),
    2
  );
  assert.ok(
    calculateEquipmentCookingSpeedMultiplier({
      equipmentType: 'Slow Cookers & Braising Equipment',
      purchasePrice: 50
    }) < 1.5
  );
});

test('legacy inferred duration wrapper remains bounded', () => {
  assert.equal(inferCookingDurationSeconds(1, 'cooked'), 90);
  assert.ok(inferCookingDurationSeconds(100000, 'perfectly_cooked') <= BELOW_LEGENDARY_COOKING_MAX_SECONDS);
});
