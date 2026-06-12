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

export const COOKING_TARGETS = Object.freeze(['cooked', 'well_cooked', 'perfectly_cooked']);

export const COOKING_TIME_BOUNDS_SECONDS = Object.freeze({
  cooked: Object.freeze({ min: 30, max: 8 * 60 * 60 }),
  well_cooked: Object.freeze({ min: 60, max: 16 * 60 * 60 }),
  perfectly_cooked: Object.freeze({ min: 3 * 60, max: 24 * 60 * 60 })
});

export const BELOW_LEGENDARY_COOKING_MAX_SECONDS = 2 * 60 * 60;
export const EQUIPPED_COOKING_MIN_SECONDS = 15;
export const EQUIPPED_COOKING_MAX_SECONDS = 12 * 60 * 60;
export const LONG_COOK_REWARD_THRESHOLD_SECONDS = 6 * 60 * 60;
export const LONG_COOK_REWARD_MAX_SECONDS = 24 * 60 * 60;
export const LONG_COOK_REWARD_MAX_MULTIPLIER = 10;

export const DEFAULT_COOKING_TIMING_SEED = 0x6d656174;

const RARITY_SCORES = Object.freeze({
  starter: 1,
  'starter-adjacent': 1.5,
  basic: 2,
  common: 2,
  uncommon: 3,
  'common upgrade': 3,
  rare: 4,
  specialty: 4,
  permanent: 4,
  'very rare': 4.5,
  epic: 4.75,
  legendary: 5,
  luxury: 5.25,
  'ultra rare': 5.5,
  'jackpot rare': 6,
  'extreme luxury': 6.5
});

const TAG_TIME_FACTORS = Object.freeze({
  slow_cook: 1.45,
  smoked: 1.4,
  smokehouse: 1.4,
  brisket: 1.4,
  roast: 1.28,
  roasting: 1.28,
  whole_cut: 1.25,
  whole_bird: 1.25,
  ribs: 1.2,
  rib: 1.2,
  bone_in: 1.12,
  luxury: 1.12,
  premium: 1.08,
  premium_cut: 1.08,
  seafood: 0.86,
  shellfish: 0.88,
  ground: 0.8,
  sausage: 0.82,
  offal: 0.75,
  trim: 0.72,
  deli: 0.7,
  cured: 0.68
});

const EQUIPMENT_TYPE_SPEED_BASES = Object.freeze({
  'steamers_and_pressure_cookers': 1.72,
  'commercial_kitchen_equipment': 1.68,
  fryers: 1.58,
  'broilers_and_salamanders': 1.55,
  'cooktops_pans_and_skillets': 1.5,
  'stovetops_and_burners': 1.48,
  ovens: 1.38,
  grills: 1.36,
  rotisseries: 1.34,
  roasters: 1.28,
  smokers: 1.16,
  'slow_cookers_and_braising_equipment': 1.12,
  'specialty_everyday_equipment': 1.3
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return seed >>> 0;
  }

  const input = String(seed ?? DEFAULT_COOKING_TIMING_SEED);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed = DEFAULT_COOKING_TIMING_SEED) {
  let state = normalizeSeed(seed);
  return function random() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state + 1) / 4294967297;
  };
}

export function calculateMeatRarityScore(input = {}) {
  const label = String(input.rarityClass ?? input.accessTier ?? '').trim().toLowerCase();
  const labelScore = RARITY_SCORES[label] ?? Math.max(1, Math.min(6, Number(input.shopStage ?? 2)));
  const baseValue = Math.max(1, Number(input.baseMeatValue ?? 1));
  const valueScore = clamp(Math.log10(baseValue / 1000 + 1) * 0.5, 0, 1.25);
  return clamp(labelScore + valueScore, 1, 7);
}

export function isLegendaryCookingTier(input = {}) {
  return calculateMeatRarityScore(input) >= 5;
}

export function calculateEquipmentCookingSpeedMultiplier(input = {}) {
  const typeSlug = String(input.equipmentType ?? '')
    .normalize('NFKD')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  const baseSpeed = EQUIPMENT_TYPE_SPEED_BASES[typeSlug] ?? 1.25;
  const purchasePrice = Math.max(0, Number(input.purchasePrice ?? 0));
  const progressionBonus = clamp(Math.log10(purchasePrice + 10) / 24, 0, 0.28);
  return Number(clamp(baseSpeed + progressionBonus, 1, 2).toFixed(4));
}

function tagTimeFactor(tags = []) {
  return tags.reduce((factor, tag) => {
    const normalized = String(tag).toLowerCase();
    return factor * (TAG_TIME_FACTORS[normalized] ?? 1);
  }, 1);
}

function interpolateSeconds(minSeconds, maxSeconds, pressure) {
  const safePressure = clamp(pressure, 0, 1);
  return Math.round(minSeconds * ((maxSeconds / minSeconds) ** safePressure));
}

export function generateDefaultCookingTimes(input = {}, random = Math.random) {
  const defaultWeightKg = Math.max(1, Number(input.defaultWeightKg ?? input.baseWeightKg ?? 1));
  const baseMeatValue = Math.max(1, Number(input.baseMeatValue ?? 1));
  const rarityScore = calculateMeatRarityScore(input);
  const legendaryCookingEligible = rarityScore >= 5;
  const weightPressure = clamp(Math.log2(defaultWeightKg) / 6, 0, 0.28);
  const rarityPressure = clamp((rarityScore - 1) / 6, 0, 0.42);
  const valuePressure = clamp(Math.log10(baseMeatValue + 1) / 7, 0, 0.22);
  const tagPressure = clamp(Math.log(tagTimeFactor(input.meatTags ?? input.tags ?? [])) / 3, -0.16, 0.2);
  const randomPressure = (Number(random()) || 0) * 0.34;
  const basePressure = clamp(0.04 + weightPressure + rarityPressure + valuePressure + tagPressure + randomPressure, 0, 1);
  const targetMax = (target) => {
    const targetBound = COOKING_TIME_BOUNDS_SECONDS[target];
    return legendaryCookingEligible
      ? targetBound.max
      : Math.min(targetBound.max, BELOW_LEGENDARY_COOKING_MAX_SECONDS);
  };

  let cooked = interpolateSeconds(
    COOKING_TIME_BOUNDS_SECONDS.cooked.min,
    targetMax('cooked'),
    basePressure - 0.16
  );
  let wellCooked = interpolateSeconds(
    COOKING_TIME_BOUNDS_SECONDS.well_cooked.min,
    targetMax('well_cooked'),
    basePressure + 0.01
  );
  let perfectlyCooked = interpolateSeconds(
    COOKING_TIME_BOUNDS_SECONDS.perfectly_cooked.min,
    targetMax('perfectly_cooked'),
    basePressure + 0.18
  );

  cooked = clamp(cooked, COOKING_TIME_BOUNDS_SECONDS.cooked.min, targetMax('cooked'));
  wellCooked = clamp(
    Math.max(wellCooked, cooked + 30),
    COOKING_TIME_BOUNDS_SECONDS.well_cooked.min,
    targetMax('well_cooked')
  );
  perfectlyCooked = clamp(
    Math.max(perfectlyCooked, wellCooked + 60),
    COOKING_TIME_BOUNDS_SECONDS.perfectly_cooked.min,
    targetMax('perfectly_cooked')
  );

  if (wellCooked >= perfectlyCooked) {
    wellCooked = Math.max(COOKING_TIME_BOUNDS_SECONDS.well_cooked.min, perfectlyCooked - 60);
  }
  if (cooked >= wellCooked) {
    cooked = Math.max(COOKING_TIME_BOUNDS_SECONDS.cooked.min, wellCooked - 30);
  }

  return {
    defaultWeightKg: Number(defaultWeightKg.toFixed(4)),
    defaultCookedSeconds: Math.round(cooked),
    defaultWellCookedSeconds: Math.round(wellCooked),
    defaultPerfectlyCookedSeconds: Math.round(perfectlyCooked),
    legendaryCookingEligible
  };
}

function defaultSecondsForTarget(input, targetCookingState) {
  if (targetCookingState === 'well_cooked') {
    return Number(input.defaultWellCookedSeconds ?? input.default_well_cooked_seconds ?? 60);
  }
  if (targetCookingState === 'perfectly_cooked') {
    return Number(input.defaultPerfectlyCookedSeconds ?? input.default_perfectly_cooked_seconds ?? 180);
  }
  return Number(input.defaultCookedSeconds ?? input.default_cooked_seconds ?? 30);
}

export function calculateLongCookMultiplier(defaultCookingSeconds) {
  const seconds = Math.max(0, Number(defaultCookingSeconds) || 0);
  if (seconds < LONG_COOK_REWARD_THRESHOLD_SECONDS) {
    return 1;
  }

  const progress = clamp(
    (Math.min(seconds, LONG_COOK_REWARD_MAX_SECONDS) - LONG_COOK_REWARD_THRESHOLD_SECONDS) /
      (LONG_COOK_REWARD_MAX_SECONDS - LONG_COOK_REWARD_THRESHOLD_SECONDS),
    0,
    1
  );
  return Number((1 + (progress * (LONG_COOK_REWARD_MAX_MULTIPLIER - 1))).toFixed(4));
}

export function calculateCookingDuration(input = {}) {
  const targetCookingState = input.targetCookingState ?? input.target_cooking_state ?? 'cooked';
  const targetBounds = COOKING_TIME_BOUNDS_SECONDS[targetCookingState] ?? COOKING_TIME_BOUNDS_SECONDS.cooked;
  const defaultCookingSeconds = clamp(
    defaultSecondsForTarget(input, targetCookingState),
    targetBounds.min,
    targetBounds.max
  );
  const defaultWeightKg = Math.max(1, Number(input.defaultWeightKg ?? input.default_weight_kg ?? 1));
  const spawnedWeight = Math.max(1, Number(input.spawnedWeight ?? input.spawned_weight ?? defaultWeightKg));
  const weightRatio = spawnedWeight / defaultWeightKg;
  const weightFactor = clamp(weightRatio ** 0.75, 0.35, 6);
  const maxPreEquipmentSeconds = (input.legendaryCookingEligible ?? input.legendary_cooking_eligible)
    ? targetBounds.max
    : Math.min(targetBounds.max, BELOW_LEGENDARY_COOKING_MAX_SECONDS);
  const preEquipmentSeconds = clamp(
    Math.round(defaultCookingSeconds * weightFactor),
    targetBounds.min,
    maxPreEquipmentSeconds
  );
  const equipmentSpeedMultiplier = clamp(
    Number(input.cookingSpeedMultiplier ?? input.cooking_speed_multiplier ?? 1) || 1,
    1,
    2
  );
  const durationSeconds = clamp(
    Math.round(preEquipmentSeconds / equipmentSpeedMultiplier),
    EQUIPPED_COOKING_MIN_SECONDS,
    EQUIPPED_COOKING_MAX_SECONDS
  );
  const longCookMultiplier = calculateLongCookMultiplier(defaultCookingSeconds);

  return {
    defaultCookingSeconds,
    preEquipmentSeconds,
    durationSeconds,
    equipmentSpeedMultiplier: Number(equipmentSpeedMultiplier.toFixed(4)),
    longCookMultiplier
  };
}

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
  const longCookMultiplier = Math.max(1, Number(input.longCookMultiplier ?? 1));
  const finalPreRoundValue =
    seasonedValue *
    longCookMultiplier *
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
    longCookMultiplier,
    finalSellingPrice: roundCurrency(finalPreRoundValue)
  };
}

export function inferCookingDurationSeconds(spawnedWeightOrInput, targetCookingState) {
  if (typeof spawnedWeightOrInput === 'object' && spawnedWeightOrInput !== null) {
    return calculateCookingDuration(spawnedWeightOrInput).durationSeconds;
  }

  return calculateCookingDuration({
    spawnedWeight: spawnedWeightOrInput,
    targetCookingState,
    defaultWeightKg: 1,
    defaultCookedSeconds: 90,
    defaultWellCookedSeconds: 113,
    defaultPerfectlyCookedSeconds: 131,
    legendaryCookingEligible: false,
    cookingSpeedMultiplier: 1
  }).durationSeconds;
}
