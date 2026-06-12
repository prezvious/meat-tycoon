export const COOKING_STATE_MULTIPLIERS = Object.freeze({
  raw: 1,
  undercooked: 0.65,
  cooked: 1.25,
  well_cooked: 1.6,
  perfectly_cooked: 2.2,
  overcooked: 0.6,
  burnt: 0.1,
  spoiled: 0
});

export const DONENESS_MULTIPLIERS = Object.freeze({
  raw: 1,
  undercooked: 0.85,
  cooked: 1,
  well_cooked: 1.08,
  perfectly_cooked: 1.2,
  overcooked: 0.75,
  burnt: 0.2,
  spoiled: 0
});

export const QUALITY_MULTIPLIERS = Object.freeze({
  raw: 1,
  undercooked: 0.9,
  cooked: 1,
  well_cooked: 1.05,
  perfectly_cooked: 1.15,
  overcooked: 0.65,
  burnt: 0.1,
  spoiled: 0
});

export const COOKED_PROFIT_FLOOR_MULTIPLIERS = Object.freeze({
  cooked: 1.05,
  well_cooked: 1.1,
  perfectly_cooked: 1.2
});

export function calculateDurabilityStrength(remainingUses, maximumUses) {
  if (maximumUses <= 0 || remainingUses <= 0) {
    return 0;
  }

  const ratio = remainingUses / maximumUses;
  if (ratio <= 0.1) {
    return 0.75;
  }
  if (ratio <= 0.3) {
    return 0.9;
  }
  return 1;
}

export function calculateSeasoningSlotStrength(index) {
  const position = index + 1;
  if (position <= 3) return 1;
  if (position === 4) return 0.75;
  if (position === 5) return 0.5;
  return 0.25;
}

export function calculateSeasoningMultiplier(seasonings) {
  if (!seasonings.length) {
    return 1;
  }

  const stacked = seasonings.reduce((product, seasoning, index) => {
    const durabilityStrength = calculateDurabilityStrength(
      seasoning.remainingUses,
      seasoning.maximumUses
    );
    const slotStrength = calculateSeasoningSlotStrength(index);
    const compatibilityStrength = seasoning.compatibilityStrength ?? 1;
    const effectiveBonus =
      (seasoning.baseMultiplier - 1) *
      durabilityStrength *
      slotStrength *
      compatibilityStrength;

    return product * Math.max(1, 1 + effectiveBonus);
  }, 1);

  return stacked;
}

export function roundCurrency(value) {
  return Math.max(0, value).toFixed(2);
}

export function calculateCookedProfitFloor(purchasePricePaid, cookingState, equipmentMultiplier = 1) {
  const floorMultiplier = COOKED_PROFIT_FLOOR_MULTIPLIERS[cookingState];
  if (!floorMultiplier) {
    return 0;
  }

  const equipmentPenalty = Math.min(1, Math.max(0, Number(equipmentMultiplier) || 1));
  return (Number(purchasePricePaid) || 0) * floorMultiplier * equipmentPenalty;
}

export function formatWeightKg(value) {
  const weight = Math.max(0, Number(value) || 0);
  const namedUnits = [
    { value: 1_000_000_000_000, label: 'trillion' },
    { value: 1_000_000_000, label: 'billion' },
    { value: 1_000_000, label: 'million' }
  ];

  for (const unit of namedUnits) {
    if (weight >= unit.value) {
      const scaled = weight / unit.value;
      const formatted = scaled.toLocaleString('en-US', {
        minimumFractionDigits: Number.isInteger(scaled) ? 0 : 2,
        maximumFractionDigits: Number.isInteger(scaled) ? 0 : 2
      });
      return `${formatted} ${unit.label} kg`;
    }
  }

  const formatted = weight.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(weight) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(weight) ? 0 : 2
  });
  return `${formatted} kg`;
}

export function calculateSaleValue(input) {
  const cookingState = input.cookingState ?? 'raw';
  const rawMeatValue = input.spawnedWeight * input.baseMeatValue;
  const meatAdjustedValue = rawMeatValue * (input.categoryMultiplier ?? 1);
  const cookedValue =
    meatAdjustedValue *
    (COOKING_STATE_MULTIPLIERS[cookingState] ?? 1) *
    (DONENESS_MULTIPLIERS[cookingState] ?? 1) *
    (QUALITY_MULTIPLIERS[cookingState] ?? 1);
  const equipmentMultiplier = Math.max(0, Number(input.equipmentMultiplier ?? 1));
  const equipmentValueBeforeFloor = cookedValue * equipmentMultiplier;
  const saleFloorValue = calculateCookedProfitFloor(
    input.purchasePricePaid,
    cookingState,
    equipmentMultiplier
  );
  const equipmentValue = Math.max(equipmentValueBeforeFloor, saleFloorValue);
  const finalSeasoningMultiplier = calculateSeasoningMultiplier(
    input.seasonings ?? []
  );
  const seasonedValue = equipmentValue * finalSeasoningMultiplier;
  const finalPreRoundValue =
    seasonedValue *
    (input.eventMultiplier ?? 1) *
    (input.temporaryMultiplier ?? 1) *
    (input.permanentMultiplier ?? 1) *
    (input.otherGlobalMultiplier ?? 1);

  return {
    rawMeatValue: roundCurrency(rawMeatValue),
    meatAdjustedValue: roundCurrency(meatAdjustedValue),
    cookedValue: roundCurrency(cookedValue),
    equipmentValue: roundCurrency(equipmentValue),
    saleFloorValue: roundCurrency(saleFloorValue),
    finalSeasoningMultiplier,
    finalSellingPrice: roundCurrency(finalPreRoundValue)
  };
}

export function inferCookingDurationSeconds(spawnedWeight, targetCookingState) {
  const targetMultipliers = {
    cooked: 1,
    well_cooked: 1.25,
    perfectly_cooked: 1.45,
    overcooked: 1.8
  };
  const safeWeight = Math.max(1, Number(spawnedWeight) || 1);
  const weightFactor = Math.min(8, Math.sqrt(safeWeight));
  return Math.round(90 * weightFactor * (targetMultipliers[targetCookingState] ?? 1));
}
