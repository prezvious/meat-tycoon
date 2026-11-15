import { gameStateSchema, type GameState } from './state-schema';
import { loadCatalogFromDocs } from '@/lib/catalog/catalog-parser.mjs';
import { hasSupabaseConfig } from '@/lib/supabase/env.mjs';
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

export type LoadErrorModel = { status: 'load_error'; message: string };

export type SignedInModel = GameState & {
  status: 'ready';
  user: { id: string; email: string | null; isAnonymous: boolean; emailVerified: boolean };
};

export type GameModel = SetupModel | SignedOutModel | SignedInModel | LoadErrorModel;

function loadFailure(error: { message: string; code?: string }): LoadErrorModel {
  console.error('Game state load failed', { message: error.message, code: error.code });
  return { status: 'load_error', message: 'Your save could not be loaded. Check the database migrations and catalog setup, then retry.' };
}

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

  try {
    return await loadPlayerState();
  } catch (error) {
    return loadFailure({ message: error instanceof Error ? error.message : 'Unexpected state service failure' });
  }
}

async function loadPlayerState(): Promise<GameModel> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }, error: authError
  } = await supabase.auth.getUser();

  if (authError && authError.name !== 'AuthSessionMissingError') return loadFailure(authError);
  if (!user) return { status: 'signed_out' };

  const initialized = await supabase.rpc('initialize_player_save');
  if (initialized.error) return loadFailure(initialized.error);

  const snapshot = await supabase.rpc('get_game_state');
  if (snapshot.error) return loadFailure(snapshot.error);
  const parsed = gameStateSchema.safeParse(snapshot.data);
  if (!parsed.success) return loadFailure({ message: parsed.error.message });

  return {
    ...parsed.data,
    status: 'ready',
    user: { id: user.id, email: user.email ?? null, isAnonymous: Boolean(user.is_anonymous), emailVerified: Boolean(user.email_confirmed_at) }
  };
}
