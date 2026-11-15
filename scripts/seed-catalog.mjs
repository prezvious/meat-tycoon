import fs from 'node:fs';
import { loadCatalogFromDocs, validateCatalog } from '../src/lib/catalog/catalog-parser.mjs';

const sqlArgument = process.argv.indexOf('--sql');
const sqlOutputPath = sqlArgument === -1 ? null : process.argv[sqlArgument + 1];
if (sqlArgument !== -1 && (!sqlOutputPath || sqlOutputPath.startsWith('--'))) {
  throw new Error('--sql requires an output file path.');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cookingTimingSeed = process.env.COOKING_TIMING_SEED ??
  (sqlOutputPath ? 'meat-tycoon-catalog-v1' : `seed-${Date.now()}`);
const catalog = loadCatalogFromDocs(process.cwd(), { cookingTimingSeed });
const issues = validateCatalog(catalog);

if (issues.length) {
  console.error('Catalog validation failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

if (!sqlOutputPath && (!supabaseUrl || !serviceRoleKey)) {
  console.log(
    JSON.stringify(
      {
        status: 'validated',
        seeded: false,
        reason: 'Supabase credentials are not configured.',
        counts: {
          meats: catalog.meats.length,
          equipment: catalog.equipment.length,
          seasonings: catalog.seasonings.length,
          weightProfiles: catalog.weightProfiles.length
        },
        cookingTimingSeed
      },
      null,
      2
    )
  );
  process.exit(0);
}

const supabase = sqlOutputPath ? null : (await import('@supabase/supabase-js')).createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const sqlStatements = [];

function sqlValue(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array[${value.map(sqlValue).join(', ')}]::text[]`;
  if (typeof value === 'string') return `'${value.replaceAll("'", "''")}'`;
  return String(value);
}

function sqlUpsert(table, rows) {
  const columns = Object.keys(rows[0]);
  const values = rows.map((row) => `  (${columns.map((column) => sqlValue(row[column])).join(', ')})`);
  const updates = columns.filter((column) => column !== 'id').map((column) => `  ${column} = excluded.${column}`);
  return `insert into public.${table} (${columns.join(', ')})\nvalues\n${values.join(',\n')}\non conflict (id) do update\nset\n${updates.join(',\n')};`;
}

async function upsert(table, rows) {
  if (sqlOutputPath) {
    sqlStatements.push(sqlUpsert(table, rows));
    return;
  }
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
}

await upsert(
  'weight_profiles',
  catalog.weightProfiles.map((profile) => ({
    id: profile.id,
    display_name: profile.displayName,
    tier_bias: profile.tierBias,
    body_min_kg: profile.bodyMinKg,
    body_max_kg: profile.bodyMaxKg,
    body_shape: profile.bodyShape,
    large_threshold_kg: profile.largeThresholdKg,
    heavy_threshold_kg: profile.heavyThresholdKg,
    massive_threshold_kg: profile.massiveThresholdKg,
    tail_chance: profile.tailChance,
    tail_anchor_kg: profile.tailAnchorKg,
    tail_alpha: profile.tailAlpha,
    enabled: profile.enabled
  }))
);

await upsert(
  'meat_items',
  catalog.meats.map((meat) => ({
    id: meat.id,
    display_name: meat.displayName,
    category: meat.category,
    cut_type: meat.cutType,
    purchase_price: meat.purchasePrice,
    base_meat_value: meat.baseMeatValue,
    category_multiplier: meat.categoryMultiplier,
    default_weight_kg: meat.defaultWeightKg,
    default_cooked_seconds: meat.defaultCookedSeconds,
    default_well_cooked_seconds: meat.defaultWellCookedSeconds,
    default_perfectly_cooked_seconds: meat.defaultPerfectlyCookedSeconds,
    legendary_cooking_eligible: meat.legendaryCookingEligible,
    access_tier: meat.accessTier,
    shop_stage: meat.shopStage,
    unlock_requirement_id: meat.unlockRequirementId,
    starter_only: meat.starterOnly,
    shop_stock_policy: meat.shopStockPolicy,
    base_shop_appearance_weight: meat.baseShopAppearanceWeight,
    rarity_class: meat.rarityClass,
    price_penalty_eligible: meat.pricePenaltyEligible,
    weight_profile_id: meat.weightProfileId,
    meat_tags: meat.meatTags,
    equipment_compatibility_tags: meat.equipmentCompatibilityTags,
    seasoning_compatibility_tags: meat.seasoningCompatibilityTags,
    enabled: meat.enabled
  }))
);

await upsert(
  'equipment_items',
  catalog.equipment.map((item) => ({
    id: item.id,
    display_name: item.displayName,
    equipment_type: item.equipmentType,
    purchase_price: item.purchasePrice,
    price_multiplier: item.priceMultiplier,
    cooking_speed_multiplier: item.cookingSpeedMultiplier,
    cooking_slot_count: item.cookingSlotCount,
    unlock_requirement_id: item.unlockRequirementId,
    equipment_tags: item.equipmentTags,
    enabled: item.enabled
  }))
);

await upsert(
  'seasoning_items',
  catalog.seasonings.map((item) => ({
    id: item.id,
    display_name: item.displayName,
    seasoning_type: item.seasoningType,
    purchase_price: item.purchasePrice,
    base_multiplier: item.baseMultiplier,
    maximum_uses: item.maximumUses,
    rarity_class: item.rarityClass,
    spawn_weight: item.spawnWeight,
    seasoning_tags: item.seasoningTags,
    enabled: item.enabled
  }))
);

if (sqlOutputPath) {
  fs.writeFileSync(sqlOutputPath,
    `-- Generated by npm run seed:sql from the Markdown catalogs.\n-- Cooking timing seed: ${JSON.stringify(cookingTimingSeed)}\nbegin;\n\n${sqlStatements.join('\n\n')}\n\ncommit;\n`
  );
}

console.log(
  JSON.stringify(
    {
      status: sqlOutputPath ? 'exported' : 'seeded',
      path: sqlOutputPath ?? undefined,
      counts: {
        meats: catalog.meats.length,
        equipment: catalog.equipment.length,
        seasonings: catalog.seasonings.length,
        weightProfiles: catalog.weightProfiles.length
      },
      cookingTimingSeed
    },
    null,
    2
  )
);
