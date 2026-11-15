import { z } from 'zod';

const decimal = z.string().regex(/^\d+(?:\.\d+)?$/);
const integer = z.string().regex(/^\d+$/);
const timestamp = z.string().datetime({ offset: true });
const nullableTime = timestamp.nullable();
const catalogItem = z.object({
  id: z.string(), display_name: z.string(), purchase_price: decimal, enabled: z.boolean()
}).passthrough();
const meatItem = catalogItem.extend({
  category: z.string(), category_multiplier: decimal, base_meat_value: decimal,
  starter_only: z.boolean(), default_weight_kg: decimal,
  default_cooked_seconds: integer, default_well_cooked_seconds: integer,
  default_perfectly_cooked_seconds: integer, legendary_cooking_eligible: z.boolean(),
  equipment_compatibility_tags: z.array(z.string())
});
const equipmentItem = catalogItem.extend({
  equipment_type: z.string(), price_multiplier: decimal,
  cooking_speed_multiplier: decimal, cooking_slot_count: integer
});
const seasoningItem = catalogItem.extend({ base_multiplier: decimal, maximum_uses: integer });
const shopType = z.enum(['meat', 'seasoning', 'equipment']);
const stock = z.object({
  id: z.string(), item_id: z.string(), purchase_price: decimal,
  current_stock: integer, maximum_stock: integer, rarity_class: z.string(), shop_type: shopType
}).passthrough();
const ownedMeat = z.object({
  id: z.string(), meat_item_id: z.string(), spawned_weight: decimal,
  purchase_price_paid: decimal, base_meat_value_snapshot: decimal,
  current_cooking_state: z.enum(['raw', 'cooking', 'undercooked', 'cooked', 'well_cooked', 'perfectly_cooked', 'overcooked', 'burnt', 'spoiled']),
  selected_equipment_item_id: z.string().nullable(), spoilage_due_at: nullableTime,
  meat_items: meatItem,
  applied_seasonings: z.array(z.object({ seasoning_instance_id: z.string(), effectiveMultiplier: decimal }))
}).passthrough();
const namedItem = z.object({ display_name: z.string() });

export const gameStateSchema = z.object({
  version: z.literal(1),
  save: z.object({ balance: decimal }).passthrough(),
  stats: z.object({ best_sale_value: decimal }).passthrough(),
  meats: z.array(meatItem),
  equipment: z.array(equipmentItem),
  seasonings: z.array(seasoningItem),
  meatStock: z.array(stock), seasoningStock: z.array(stock),
  shopStates: z.array(z.object({
    shop_type: shopType, shop_stage: integer, luck_level: integer,
    refresh_speed_level: integer, refresh_due_at: nullableTime
  }).passthrough()),
  saleModifierDefinitions: z.array(z.object({ id: z.string(), display_name: z.string(), multiplier: decimal }).passthrough()),
  activeSaleModifiers: z.array(z.object({ id: z.string(), definition_id: z.string(), expires_at: nullableTime, active: z.boolean() }).passthrough()),
  ownedMeats: z.array(ownedMeat),
  ownedEquipment: z.array(z.object({
    equipment_item_id: z.string(), quantity: integer, active: z.boolean(), equipment_items: equipmentItem
  }).passthrough()),
  ownedSeasonings: z.array(z.object({
    id: z.string(), remaining_uses: integer, maximum_uses: integer, seasoning_items: seasoningItem
  }).passthrough()),
  cookingJobs: z.array(z.object({
    id: z.string(), meat_instance_id: z.string(), equipment_item_id: z.string(),
    cooking_started_at: timestamp, cooking_target_end_at: timestamp, target_cooking_state: z.string(),
    meat_instances: z.object({ meat_items: namedItem }), equipment_items: namedItem
  }).passthrough())
});

export type GameState = z.infer<typeof gameStateSchema>;
