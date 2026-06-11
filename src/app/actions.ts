'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { hasSupabaseConfig } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type ActionResult = {
  ok: boolean;
  message?: string;
};

async function configuredClient() {
  if (!hasSupabaseConfig()) {
    return {
      error: 'Supabase is not configured.'
    } as const;
  }

  return {
    supabase: await createSupabaseServerClient()
  } as const;
}

function accountUsedMessage() {
  return 'That account is already used. Sign in to that account or use a different email or provider.';
}

async function currentUser() {
  const client = await configuredClient();
  if ('error' in client) return { client, user: null };

  const {
    data: { user }
  } = await client.supabase.auth.getUser();

  return { client, user };
}

async function runRpc(name: string, args?: Record<string, unknown>): Promise<ActionResult> {
  const client = await configuredClient();
  if ('error' in client) return { ok: false, message: client.error };

  const { error } = await client.supabase.rpc(name, args);
  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath('/');
  return { ok: true };
}

export async function startGuestSession(): Promise<ActionResult> {
  const client = await configuredClient();
  if ('error' in client) return { ok: false, message: client.error };

  const { error } = await client.supabase.auth.signInAnonymously();
  if (error) return { ok: false, message: error.message };

  await client.supabase.rpc('initialize_player_save');
  revalidatePath('/');
  return { ok: true };
}

export async function signInWithPassword(email: string, password: string): Promise<ActionResult> {
  const client = await configuredClient();
  if ('error' in client) return { ok: false, message: client.error };

  const { error } = await client.supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: error.message };

  await client.supabase.rpc('initialize_player_save');
  revalidatePath('/');
  return { ok: true };
}

export async function signUpWithPassword(email: string, password: string): Promise<ActionResult> {
  const { client, user } = await currentUser();
  if ('error' in client) return { ok: false, message: client.error };

  if (user?.is_anonymous) {
    const { error } = await client.supabase.auth.updateUser({ email, password });
    if (error) {
      return { ok: false, message: /already|registered|exists/i.test(error.message) ? accountUsedMessage() : error.message };
    }

    await client.supabase.rpc('initialize_player_save');
    revalidatePath('/');
    return { ok: true };
  }

  const { error, data } = await client.supabase.auth.signUp({ email, password });
  if (error) {
    return { ok: false, message: /already|registered|exists/i.test(error.message) ? accountUsedMessage() : error.message };
  }
  if (data.user && !data.user.is_anonymous && data.user.identities?.length === 0) {
    return { ok: false, message: accountUsedMessage() };
  }

  await client.supabase.rpc('initialize_player_save');
  revalidatePath('/');
  return { ok: true };
}

export async function sendMagicLink(email: string): Promise<ActionResult> {
  const { client, user } = await currentUser();
  if ('error' in client) return { ok: false, message: client.error };

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback`;
  if (user?.is_anonymous) {
    const { error } = await client.supabase.auth.updateUser(
      { email },
      {
        emailRedirectTo: redirectTo
      }
    );

    if (error) {
      return { ok: false, message: /already|registered|exists/i.test(error.message) ? accountUsedMessage() : error.message };
    }

    return { ok: true, message: 'Check your email to attach this guest save.' };
  }

  const { error } = await client.supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: false
    }
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true, message: 'Check your email for the sign-in link.' };
}

export async function signInWithGoogle() {
  const { client, user } = await currentUser();
  if ('error' in client) return redirect('/');

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback`;
  const { data, error } = user?.is_anonymous
    ? await client.supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          redirectTo
        }
      })
    : await client.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo
        }
      });

  if (error || !data.url) {
    redirect('/');
  }

  redirect(data.url);
}

export async function signOut() {
  const client = await configuredClient();
  if ('error' in client) {
    revalidatePath('/');
    return;
  }

  await client.supabase.auth.signOut();
  revalidatePath('/');
}

export async function buyMeat(meatId: string) {
  return runRpc('buy_meat', { p_meat_item_id: meatId });
}

export async function buyEquipment(equipmentId: string) {
  return runRpc('buy_equipment', { p_equipment_item_id: equipmentId });
}

export async function buySeasoning(seasoningId: string) {
  return runRpc('buy_seasoning', { p_seasoning_item_id: seasoningId });
}

export async function startCooking(
  meatInstanceId: string,
  equipmentItemId: string,
  targetCookingState: string
) {
  return runRpc('start_cooking', {
    p_meat_instance_id: meatInstanceId,
    p_equipment_item_id: equipmentItemId,
    p_target_cooking_state: targetCookingState
  });
}

export async function applySeasoning(meatInstanceId: string, seasoningInstanceId: string) {
  return runRpc('apply_seasoning', {
    p_meat_instance_id: meatInstanceId,
    p_seasoning_instance_id: seasoningInstanceId
  });
}

export async function sellMeat(meatInstanceId: string) {
  return runRpc('sell_meat', { p_meat_instance_id: meatInstanceId });
}

export async function sellAllMeat() {
  return runRpc('sell_all_meat');
}

export async function manualRefreshShop(shopType: string) {
  return runRpc('manual_refresh_shop', { p_shop_type: shopType });
}

export async function buyShopRefreshSpeed(shopType: string) {
  return runRpc('buy_shop_refresh_speed', { p_shop_type: shopType });
}

export async function buyShopLuck(shopType: string) {
  return runRpc('buy_shop_luck', { p_shop_type: shopType });
}

export async function sellSeasoning(seasoningInstanceId: string) {
  return runRpc('sell_seasoning', { p_seasoning_instance_id: seasoningInstanceId });
}

export async function destroyEquipment(equipmentId: string) {
  return runRpc('destroy_equipment', { p_equipment_item_id: equipmentId });
}

export async function claimSaleModifier(modifierId: string) {
  return runRpc('claim_sale_modifier', { p_modifier_id: modifierId });
}

export async function resolveTimeProgress() {
  return runRpc('resolve_time_progress');
}
