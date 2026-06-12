import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_WEIGHT_PROFILE = 'medium_cut_standard';
const WEIGHT_FLOOR_KG = 1;
const MIN_NORMALIZED_BODY_MAX_KG = 3;

const STAGE_BY_TIER = Object.freeze({
  starter: 1,
  'starter-adjacent': 2,
  basic: 2,
  'common upgrade': 3,
  specialty: 4,
  luxury: 5,
  'extreme luxury': 6
});

const CATEGORY_MULTIPLIERS = Object.freeze({
  poultry: 1,
  pork: 1.05,
  beef: 1.15,
  'lamb_and_goat': 1.12,
  'sausages_and_similar_items': 0.95,
  'deli_and_cured_meats': 1.08,
  veal: 1.12,
  'game_and_specialty_meats': 1.2,
  'luxury_and_specialty_meats': 1.35,
  seafood: 1.1
});

const DEFAULT_PROFILE_PARAMETERS = Object.freeze({
  bodyMinKg: 1,
  bodyMaxKg: 5,
  bodyShape: 1,
  largeThresholdKg: 2.5,
  heavyThresholdKg: 4,
  massiveThresholdKg: 8,
  tailChance: 0.01,
  tailAnchorKg: 5,
  tailAlpha: 1.8
});

export const STAGE_BREAK_EVEN_TARGETS = Object.freeze({
  1: 2,
  2: 5,
  3: 20,
  4: 50,
  5: 100,
  6: 200
});

function readDoc(rootDir, fileName) {
  return fs.readFileSync(path.join(rootDir, fileName), 'utf8');
}

export function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

export function parseMoney(value) {
  return value.replace(/[$,]/g, '').trim();
}

function parseMultiplier(value) {
  return Number(value.replace(/[,x]/g, '').trim());
}

function tierToStage(tier) {
  return STAGE_BY_TIER[tier.toLowerCase()] ?? 2;
}

function categoryMultiplier(category) {
  return CATEGORY_MULTIPLIERS[slugify(category)] ?? 1;
}

function formatMoney(value) {
  return Math.max(0, value).toFixed(2);
}

function formatMoneyCeil(value) {
  return formatMoney(Math.ceil(Math.max(0, value) * 100) / 100);
}

export function normalizeWeightProfileParameters(params) {
  const bodyMinKg = Math.max(WEIGHT_FLOOR_KG, Number(params.bodyMinKg) || WEIGHT_FLOOR_KG);
  const originalMax = Number(params.bodyMaxKg) || MIN_NORMALIZED_BODY_MAX_KG;
  const bodyMaxKg =
    originalMax <= WEIGHT_FLOOR_KG
      ? MIN_NORMALIZED_BODY_MAX_KG
      : Math.max(originalMax, bodyMinKg + 0.01);
  const range = bodyMaxKg - bodyMinKg;

  return {
    ...params,
    bodyMinKg,
    bodyMaxKg,
    largeThresholdKg: bodyMinKg + range * 0.5,
    heavyThresholdKg: bodyMinKg + range * 0.8,
    massiveThresholdKg: bodyMinKg + range * 0.95,
    tailAnchorKg: Math.max(WEIGHT_FLOOR_KG, Number(params.tailAnchorKg) || WEIGHT_FLOOR_KG)
  };
}

export function calculateExpectedWeight(profile) {
  const shape = Math.max(Number(profile.bodyShape) || 1, 0.01);
  const bodyExpected =
    profile.bodyMinKg + ((profile.bodyMaxKg - profile.bodyMinKg) / (shape + 1));
  const tailChance = Math.max(0, Math.min(1, Number(profile.tailChance) || 0));
  const tailAlpha = Math.max(Number(profile.tailAlpha) || 1.01, 1.01);
  const tailExpected = (tailAlpha * profile.tailAnchorKg) / (tailAlpha - 1);

  return ((1 - tailChance) * bodyExpected) + (tailChance * tailExpected);
}

function stageBreakEvenTarget(stage) {
  return STAGE_BREAK_EVEN_TARGETS[stage] ?? STAGE_BREAK_EVEN_TARGETS[6];
}

function balanceMeatBaseValues(meats, weightProfiles) {
  const profileById = new Map(weightProfiles.map((profile) => [profile.id, profile]));

  return meats.map((meat) => {
    const profile = profileById.get(meat.weightProfileId);
    const expectedWeight = profile ? calculateExpectedWeight(profile) : WEIGHT_FLOOR_KG;
    const purchasePrice = Number(meat.purchasePrice);
    const documentedValue = Number(meat.baseMeatValue);
    const target = stageBreakEvenTarget(meat.shopStage);
    const targetValue = purchasePrice / Math.max(WEIGHT_FLOOR_KG, expectedWeight * target);
    const baseMeatValue =
      targetValue > documentedValue
        ? Number(formatMoneyCeil(targetValue))
        : documentedValue;

    return {
      ...meat,
      baseMeatValue: formatMoney(baseMeatValue)
    };
  });
}

function inferMeatTags(displayName, category, tier) {
  const base = [slugify(category), slugify(tier)];
  const lowerName = displayName.toLowerCase();
  if (lowerName.includes('whole')) base.push('whole_cut');
  if (lowerName.includes('ground')) base.push('ground');
  if (lowerName.includes('rib')) base.push('rib');
  if (lowerName.includes('brisket')) base.push('slow_cook');
  if (lowerName.includes('steak') || lowerName.includes('chop')) base.push('premium_cut');
  if (lowerName.includes('liver') || lowerName.includes('heart') || lowerName.includes('gizzard')) {
    base.push('offal');
  }
  return [...new Set(base)];
}

function inferWeightProfile(displayName) {
  const lowerName = displayName.toLowerCase();
  if (lowerName.includes('whole') && lowerName.includes('turkey')) return 'whole_bird_large';
  if (lowerName.includes('whole')) return 'whole_bird_medium';
  if (lowerName.includes('ground')) return 'ground_bulk';
  if (lowerName.includes('sausage') || lowerName.includes('bratwurst')) return 'sausage_processed';
  if (lowerName.includes('rib')) return 'ribs_rack';
  if (lowerName.includes('shank') || lowerName.includes('hock')) return 'shank_hock_bone_cut';
  if (lowerName.includes('steak') || lowerName.includes('chop') || lowerName.includes('cutlet')) {
    return 'premium_steak_cut';
  }
  if (lowerName.includes('liver') || lowerName.includes('heart') || lowerName.includes('gizzard')) {
    return 'offal_small';
  }
  if (lowerName.includes('roast') || lowerName.includes('brisket')) return 'heavy_roast_cut';
  if (lowerName.includes('feet')) return 'tiny_part_jackpot_possible';
  return DEFAULT_WEIGHT_PROFILE;
}

export function parseMeatCatalog(markdown) {
  return parseMeatCatalogWithProfiles(markdown);
}

export function parseMeatCatalogWithProfiles(markdown, weightMarkdown = '') {
  const meats = [];
  let category = 'General';
  const weightAssignments = weightMarkdown ? parseWeightProfileAssignments(weightMarkdown) : new Map();

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^#{2,3}\s+(.+)$/);
    if (heading) {
      category = heading[1].trim();
      continue;
    }

    if (!line.startsWith('|') || line.includes('---') || line.toLowerCase().includes('| meat |')) {
      continue;
    }

    const columns = line
      .split('|')
      .slice(1, -1)
      .map((column) => column.trim());

    if (columns.length < 5 || !columns[1].startsWith('$') || !columns[2].startsWith('$')) {
      continue;
    }

    const displayName = columns[0];
    const tier = columns[3];
    const starterOnly = /^yes$/i.test(columns[4]);

    meats.push({
      id: slugify(displayName),
      displayName,
      category,
      cutType: weightAssignments.get(slugify(displayName)) ?? inferWeightProfile(displayName),
      purchasePrice: parseMoney(columns[1]),
      baseMeatValue: parseMoney(columns[2]),
      categoryMultiplier: categoryMultiplier(category),
      accessTier: tier,
      shopStage: tierToStage(tier),
      unlockRequirementId: null,
      starterOnly,
      shopStockPolicy: starterOnly ? 'permanent' : 'rng',
      baseShopAppearanceWeight: starterOnly ? 100 : Math.max(1, 50 / tierToStage(tier)),
      rarityClass: tier,
      pricePenaltyEligible: !starterOnly,
      weightProfileId: weightAssignments.get(slugify(displayName)) ?? inferWeightProfile(displayName),
      meatTags: inferMeatTags(displayName, category, tier),
      equipmentCompatibilityTags: inferMeatTags(displayName, category, tier),
      seasoningCompatibilityTags: inferMeatTags(displayName, category, tier),
      enabled: true
    });
  }

  return dedupeById(meats);
}

export function parseWeightProfileAssignments(markdown) {
  const assignments = new Map();

  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^\|\s*(.+?)\s*\|\s*`([^`]+)`\s*\|$/);
    if (!match || /^-+$/.test(match[1].trim()) || /^meat$/i.test(match[1].trim())) continue;
    assignments.set(slugify(match[1].trim()), match[2].trim());
  }

  return assignments;
}

function parseProfileParameterTable(markdown) {
  const parameters = new Map();

  for (const line of markdown.split(/\r?\n/)) {
    const columns = line
      .split('|')
      .slice(1, -1)
      .map((column) => column.trim());

    if (columns.length < 10 || !columns[0].startsWith('`') || /^-+$/.test(columns[1])) {
      continue;
    }

    parameters.set(columns[0].replace(/`/g, ''), {
      bodyMinKg: Number(columns[1]),
      bodyMaxKg: Number(columns[2]),
      bodyShape: Number(columns[3]),
      largeThresholdKg: Number(columns[4]),
      heavyThresholdKg: Number(columns[5]),
      massiveThresholdKg: Number(columns[6]),
      tailChance: Number(columns[7]),
      tailAnchorKg: Number(columns[8]),
      tailAlpha: Number(columns[9])
    });
  }

  return parameters;
}

function inferEquipmentSlots(name) {
  const lowerName = name.toLowerCase();
  if (lowerName === 'bamboo steamer' || lowerName.includes('bamboo steamer')) {
    return 5;
  }
  if (lowerName.includes('full') || lowerName.includes('industrial') || lowerName.includes('production')) {
    return 30;
  }
  if (lowerName.includes('commercial') || lowerName.includes('restaurant')) return 16;
  if (lowerName.includes('large') || lowerName.includes('multi') || lowerName.includes('double')) return 8;
  if (lowerName.includes('standard') || lowerName.includes('basic')) return 3;
  return 1;
}

export function parseEquipmentCatalog(markdown) {
  const equipment = [];
  let equipmentType = 'General Equipment';
  const bulletPattern =
    /^\*\s+(.+?)\s+\((\$[\d,]+(?:\.\d{2})?)\)\.\s+(?:Starter equipment\.\s+)?Equipment price in USD\.\s+Price multiplier:\s+([\d,.]+)x\./;

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^#{2,3}\s+(.+)$/);
    if (heading) {
      equipmentType = heading[1].trim();
      continue;
    }

    const match = line.match(bulletPattern);
    if (!match) continue;

    const displayName = match[1].trim();
    const tags = [slugify(equipmentType), ...displayName.split(/\s+/).map(slugify)].filter(Boolean);

    equipment.push({
      id: slugify(displayName),
      displayName,
      equipmentType,
      purchasePrice: parseMoney(match[2]),
      priceMultiplier: parseMultiplier(match[3]),
      cookingSlotCount: inferEquipmentSlots(displayName),
      unlockRequirementId: null,
      equipmentTags: [...new Set(tags)],
      enabled: true
    });
  }

  return dedupeById(equipment);
}

export function parseSeasoningCatalog(markdown) {
  const seasonings = [];
  let seasoningType = 'General Seasoning';
  const bulletPattern =
    /^\*\s+(.+?)\s+\((\$[\d,]+(?:\.\d{2})?)\)\.\s+Seasoning tool\.\s+Multiplier:\s+([\d,.]+)x\.\s+Durability:\s+(\d+)\s+uses?\.\s+Rarity:\s+(.+?)\.\s+Spawn weight:\s+([\d.]+)\./;

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^#{2,3}\s+(.+)$/);
    if (heading) {
      seasoningType = heading[1].trim();
      continue;
    }

    const match = line.match(bulletPattern);
    if (!match) continue;

    const displayName = match[1].trim();
    const tags = [slugify(seasoningType), ...displayName.split(/\s+/).map(slugify)].filter(Boolean);

    seasonings.push({
      id: slugify(displayName),
      displayName,
      seasoningType,
      purchasePrice: parseMoney(match[2]),
      baseMultiplier: parseMultiplier(match[3]),
      maximumUses: Number(match[4]),
      rarityClass: match[5].trim(),
      spawnWeight: Number(match[6]),
      seasoningTags: [...new Set(tags)],
      expires: false,
      enabled: true
    });
  }

  return dedupeById(seasonings);
}

export function parseWeightProfiles(markdown) {
  const profiles = [];
  const seen = new Set();
  const parameterTable = parseProfileParameterTable(markdown);

  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^###\s+`([^`]+)`/);
    if (!match || seen.has(match[1])) continue;

    const id = match[1];
    const params = normalizeWeightProfileParameters(parameterTable.get(id) ?? DEFAULT_PROFILE_PARAMETERS);
    seen.add(id);
    profiles.push({
      id,
      displayName: id
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
      tierBias: 1,
      bodyMinKg: params.bodyMinKg,
      bodyMaxKg: params.bodyMaxKg,
      bodyShape: params.bodyShape,
      largeThresholdKg: params.largeThresholdKg,
      heavyThresholdKg: params.heavyThresholdKg,
      massiveThresholdKg: params.massiveThresholdKg,
      tailChance: params.tailChance,
      tailAnchorKg: params.tailAnchorKg,
      tailAlpha: params.tailAlpha,
      enabled: true
    });
  }

  return profiles;
}

function dedupeById(rows) {
  const byId = new Map();
  for (const row of rows) {
    if (!byId.has(row.id)) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()];
}

export function loadCatalogFromDocs(rootDir = process.cwd()) {
  const meatMarkdown = readDoc(rootDir, 'base-meat-values.md');
  const equipmentMarkdown = readDoc(rootDir, 'equipment-list.md');
  const seasoningMarkdown = readDoc(rootDir, 'seasoning-list.md');
  const weightMarkdown = readDoc(rootDir, 'Weight-Profiles-Per-Meat.md');

  const weightProfiles = parseWeightProfiles(weightMarkdown);
  const meats = balanceMeatBaseValues(
    parseMeatCatalogWithProfiles(meatMarkdown, weightMarkdown),
    weightProfiles
  );

  return {
    meats,
    equipment: parseEquipmentCatalog(equipmentMarkdown),
    seasonings: parseSeasoningCatalog(seasoningMarkdown),
    weightProfiles
  };
}

export function validateCatalog(catalog) {
  const issues = [];

  if (!catalog.meats.length) issues.push('No meat items parsed.');
  if (!catalog.equipment.length) issues.push('No equipment items parsed.');
  if (!catalog.seasonings.length) issues.push('No seasoning items parsed.');
  if (!catalog.weightProfiles.length) issues.push('No weight profiles parsed.');

  if (!catalog.meats.some((meat) => meat.id === 'chicken_feet' && meat.starterOnly)) {
    issues.push('Starter fallback meat Chicken Feet is missing.');
  }

  if (!catalog.equipment.some((item) => item.id === 'countertop_oven' && item.purchasePrice === '0.00')) {
    issues.push('Starter equipment Countertop Oven is missing or not free.');
  }

  const profileIds = new Set(catalog.weightProfiles.map((profile) => profile.id));
  for (const meat of catalog.meats) {
    if (!profileIds.has(meat.weightProfileId)) {
      issues.push(`${meat.displayName} references missing weight profile ${meat.weightProfileId}.`);
    }
  }

  for (const profile of catalog.weightProfiles) {
    if (!(profile.bodyMinKg >= WEIGHT_FLOOR_KG) || !(profile.bodyMaxKg > profile.bodyMinKg)) {
      issues.push(`${profile.displayName} has invalid body weight range.`);
    }
    if (!(profile.largeThresholdKg <= profile.heavyThresholdKg && profile.heavyThresholdKg <= profile.massiveThresholdKg)) {
      issues.push(`${profile.displayName} has invalid rarity thresholds.`);
    }
  }

  for (const seasoning of catalog.seasonings) {
    if (seasoning.expires !== false) {
      issues.push(`${seasoning.displayName} incorrectly has expiration behavior.`);
    }
  }

  return issues;
}
