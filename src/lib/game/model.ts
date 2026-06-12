import { loadCatalogFromDocs } from '@/lib/catalog/catalog-parser.mjs';
import { hasSupabaseConfig } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type SetupModel = {
  status: 'setup_required';
  catalogCounts: {
    meats: number;
    equipment: number;
    seasonings: number;
    weightProfiles: number;
  };
};

export type SignedOutModel = {
  status: 'signed_out';
};

export type SignedInModel = {
  status: 'ready';
  user: {
    id: string;
    email: string | null;
    isAnonymous: boolean;
  };
  save: Record<string, unknown> | null;
  stats: Record<string, unknown> | null;
  meats: Record<string, unknown>[];
  equipment: Record<string, unknown>[];
  seasonings: Record<string, unknown>[];
  meatStock: Record<string, unknown>[];
  seasoningStock: Record<string, unknown>[];
  shopStates: Record<string, unknown>[];
  saleModifierDefinitions: Record<string, unknown>[];
  activeSaleModifiers: Record<string, unknown>[];
  ownedMeats: Record<string, unknown>[];
  ownedEquipment: Record<string, unknown>[];
  ownedSeasonings: Record<string, unknown>[];
  cookingJobs: Record<string, unknown>[];
};

export type GameModel = SetupModel | SignedOutModel | SignedInModel;

function localCatalogCounts(): SetupModel['catalogCounts'] {
  const catalog = loadCatalogFromDocs(process.cwd());
  return {
    meats: catalog.meats.length,
    equipment: catalog.equipment.length,
    seasonings: catalog.seasonings.length,
    weightProfiles: catalog.weightProfiles.length
  };
}

export async function loadGameModel(): Promise<GameModel> {
  if (!hasSupabaseConfig()) {
    return {
      status: 'setup_required',
      catalogCounts: localCatalogCounts()
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: 'signed_out' };
  }

  await supabase.rpc('initialize_player_save');
  await supabase.rpc('resolve_time_progress');

  const [
    save,
    stats,
    meats,
    equipment,
    seasonings,
    meatStock,
    seasoningStock,
    shopStates,
    saleModifierDefinitions,
    activeSaleModifiers,
    ownedMeats,
    ownedEquipment,
    ownedSeasonings,
    cookingJobs
  ] = await Promise.all([
    supabase.from('player_saves').select('*').single(),
    supabase.from('lifetime_statistics').select('*').single(),
    supabase
      .from('meat_items')
      .select('*')
      .eq('enabled', true)
      .order('shop_stage', { ascending: true })
      .order('purchase_price', { ascending: true })
      .limit(300),
    supabase
      .from('equipment_items')
      .select('*')
      .eq('enabled', true)
      .order('purchase_price', { ascending: true })
      .limit(300),
    supabase
      .from('seasoning_items')
      .select('*')
      .eq('enabled', true)
      .order('purchase_price', { ascending: true })
      .limit(300),
    supabase.from('shop_stock_entries').select('*').eq('shop_type', 'meat'),
    supabase.from('shop_stock_entries').select('*').eq('shop_type', 'seasoning'),
    supabase.from('shop_states').select('*').order('shop_type', { ascending: true }),
    supabase.from('sale_modifier_definitions').select('*').eq('enabled', true),
    supabase.from('player_sale_modifiers').select('*').eq('active', true),
    supabase
      .from('meat_instances')
      .select('*, meat_items(display_name, category, category_multiplier, base_meat_value, default_weight_kg, default_cooked_seconds, default_well_cooked_seconds, default_perfectly_cooked_seconds, legendary_cooking_eligible, equipment_compatibility_tags), applied_seasonings:meat_applied_seasonings(seasoning_instance_id, baseMultiplier:effective_multiplier)')
      .is('sold_at', null)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase.from('owned_equipment').select('*, equipment_items(*)'),
    supabase
      .from('owned_seasoning_instances')
      .select('*, seasoning_items(*)')
      .gt('remaining_uses', 0),
    supabase
      .from('cooking_jobs')
      .select('*, meat_instances(meat_items(display_name)), equipment_items(display_name)')
      .eq('cooking_completed', false)
      .order('cooking_target_end_at', { ascending: true })
  ]);

  return {
    status: 'ready',
    user: {
      id: user.id,
      email: user.email ?? null,
      isAnonymous: Boolean(user.is_anonymous)
    },
    save: save.data ?? null,
    stats: stats.data ?? null,
    meats: meats.data ?? [],
    equipment: equipment.data ?? [],
    seasonings: seasonings.data ?? [],
    meatStock: meatStock.data ?? [],
    seasoningStock: seasoningStock.data ?? [],
    shopStates: shopStates.data ?? [],
    saleModifierDefinitions: saleModifierDefinitions.data ?? [],
    activeSaleModifiers: activeSaleModifiers.data ?? [],
    ownedMeats: ownedMeats.data ?? [],
    ownedEquipment: ownedEquipment.data ?? [],
    ownedSeasonings: ownedSeasonings.data ?? [],
    cookingJobs: cookingJobs.data ?? []
  };
}
