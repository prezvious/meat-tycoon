import { createClient } from '@supabase/supabase-js';
import { loadCatalogFromDocs, validateCatalog } from '../src/lib/catalog/catalog-parser.mjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const catalog = loadCatalogFromDocs(process.cwd());
const issues = validateCatalog(catalog);

if (issues.length) {
  console.error('Catalog validation failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

if (!supabaseUrl || !serviceRoleKey) {
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
        }
      },
      null,
      2
    )
  );
  process.exit(0);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function upsert(table, rows) {
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

console.log(
  JSON.stringify(
    {
      status: 'seeded',
      counts: {
        meats: catalog.meats.length,
        equipment: catalog.equipment.length,
        seasonings: catalog.seasonings.length,
        weightProfiles: catalog.weightProfiles.length
      }
    },
    null,
    2
  )
);
