import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDurabilityStrength,
  calculateSaleValue,
  calculateSeasoningMultiplier,
  calculateSeasoningSlotStrength,
  formatWeightKg,
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

  assert.equal(result.finalSeasoningMultiplier, 2, 'seasoning must be capped by equipment');
  assert.equal(result.finalSellingPrice, '607.20');
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
    ],
    100
  );

  assert.equal(result, 2 * 2 * 2 * 2.125);
});

test('no seasonings produce neutral multiplier', () => {
  assert.equal(calculateSeasoningMultiplier([], 5), 1);
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

test('cooking duration scales with real meat weight and target state', () => {
  const smallCooked = inferCookingDurationSeconds(1, 'cooked');
  const heavyPerfect = inferCookingDurationSeconds(25, 'perfectly_cooked');

  assert.ok(smallCooked >= 60);
  assert.ok(heavyPerfect > smallCooked);
});

test('cooking duration has a weight-factor cap', () => {
  assert.equal(inferCookingDurationSeconds(100, 'perfectly_cooked'), 1044);
  assert.equal(inferCookingDurationSeconds(1000, 'perfectly_cooked'), 1044);
  assert.equal(inferCookingDurationSeconds(50000, 'perfectly_cooked'), 1044);
});
