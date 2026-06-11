import { loadCatalogFromDocs } from '../src/lib/catalog/catalog-parser.mjs';
import { calculateSaleValue } from '../src/lib/game/formulas.mjs';

const DEFAULT_SAMPLE_COUNT = 100_000_000;
const COOKED_STATES = ['cooked', 'well_cooked', 'perfectly_cooked'];

function parseSampleCount(argv) {
  const sampleArg = argv.find((arg) => arg.startsWith('--samples='));
  if (!sampleArg) return DEFAULT_SAMPLE_COUNT;

  const value = Number(sampleArg.split('=')[1]);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('--samples must be a positive safe integer');
  }
  return value;
}

function createRandom(seed = 0xdecafbad) {
  let state = seed >>> 0;
  return function random() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state + 1) / 4294967297;
  };
}

function rarityLabel(weight) {
  if (weight >= 100_000_000) return 'impossible';
  if (weight >= 1_000_000) return 'absurd';
  if (weight >= 100_000) return 'giant';
  if (weight >= 10_000) return 'huge';
  if (weight >= 1_000) return 'massive';
  if (weight >= 250) return 'heavy';
  if (weight >= 50) return 'large';
  if (weight >= 10) return 'normal';
  if (weight >= 2) return 'small';
  if (weight >= 1) return 'tiny';
  return 'invalid';
}

function rollWeight(profile, random) {
  const bodyMin = Math.max(1, Number(profile.bodyMinKg) || 1);
  const bodyMax =
    Number(profile.bodyMaxKg) <= 1
      ? 3
      : Math.max(Number(profile.bodyMaxKg) || 3, bodyMin + 0.01);
  const bodyShape = Math.max(Number(profile.bodyShape) || 1, 0.01);
  const bodyRoll = bodyMin + ((bodyMax - bodyMin) * Math.pow(random(), bodyShape));
  const tailChance = Math.max(0, Number(profile.tailChance) || 0);
  const tailAlpha = Math.max(Number(profile.tailAlpha) || 1.01, 1.01);

  let rolled = bodyRoll;
  if (random() < tailChance) {
    rolled = Math.max(1, Number(profile.tailAnchorKg) || 1) /
      Math.pow(Math.max(random(), 0.000001), 1 / tailAlpha);
  }

  const weight = Math.round(Math.max(1, rolled) * 100) / 100;
  return { weight, rarity: rarityLabel(weight) };
}

function createStats(profile) {
  return {
    id: profile.id,
    count: 0,
    min: Number.POSITIVE_INFINITY,
    max: 0,
    sum: 0,
    invalidWeights: 0,
    invalidDecimals: 0,
    rarity: new Map()
  };
}

function updateStats(stats, roll) {
  stats.count += 1;
  stats.min = Math.min(stats.min, roll.weight);
  stats.max = Math.max(stats.max, roll.weight);
  stats.sum += roll.weight;
  if (roll.weight < 1) stats.invalidWeights += 1;
  if (Math.abs((roll.weight * 100) - Math.round(roll.weight * 100)) > 0.000001) {
    stats.invalidDecimals += 1;
  }
  stats.rarity.set(roll.rarity, (stats.rarity.get(roll.rarity) ?? 0) + 1);
}

function auditCookedProfit(catalog) {
  const failures = [];

  for (const meat of catalog.meats) {
    for (const state of COOKED_STATES) {
      const result = calculateSaleValue({
        spawnedWeight: 1,
        baseMeatValue: Number(meat.baseMeatValue),
        categoryMultiplier: Number(meat.categoryMultiplier),
        cookingState: state,
        equipmentMultiplier: 1,
        purchasePricePaid: Number(meat.purchasePrice),
        seasonings: []
      });
      const saleValue = Number(result.finalSellingPrice);

      if (!(saleValue > Number(meat.purchasePrice))) {
        failures.push({
          meat: meat.id,
          state,
          purchasePrice: meat.purchasePrice,
          saleValue: result.finalSellingPrice
        });
      }
    }
  }

  return failures;
}

function summarizeStats(statsByProfile) {
  return [...statsByProfile.values()].map((stats) => ({
    profile: stats.id,
    samples: stats.count,
    min: Number.isFinite(stats.min) ? stats.min.toFixed(2) : '0.00',
    average: (stats.sum / Math.max(1, stats.count)).toFixed(2),
    max: stats.max.toFixed(2),
    invalidWeights: stats.invalidWeights,
    invalidDecimals: stats.invalidDecimals,
    rarity: Object.fromEntries([...stats.rarity.entries()].sort())
  }));
}

const sampleCount = parseSampleCount(process.argv.slice(2));
const catalog = loadCatalogFromDocs(process.cwd());
const random = createRandom();
const statsByProfile = new Map(catalog.weightProfiles.map((profile) => [profile.id, createStats(profile)]));

for (let index = 0; index < sampleCount; index += 1) {
  const profile = catalog.weightProfiles[index % catalog.weightProfiles.length];
  updateStats(statsByProfile.get(profile.id), rollWeight(profile, random));
}

const summaries = summarizeStats(statsByProfile);
const profitFailures = auditCookedProfit(catalog);
const invalidWeightCount = summaries.reduce((sum, row) => sum + row.invalidWeights, 0);
const invalidDecimalCount = summaries.reduce((sum, row) => sum + row.invalidDecimals, 0);

console.log(JSON.stringify({
  samples: sampleCount,
  profiles: summaries.length,
  invalidWeightCount,
  invalidDecimalCount,
  cookedProfitFailureCount: profitFailures.length,
  cookedProfitFailures: profitFailures.slice(0, 20),
  summaries
}, null, 2));

if (invalidWeightCount > 0 || invalidDecimalCount > 0 || profitFailures.length > 0) {
  process.exitCode = 1;
}
