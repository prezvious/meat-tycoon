import { hasSupabaseConfig } from '@/lib/supabase/env.mjs';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const failed = () => NextResponse.redirect(new URL('/auth/error', url.origin));
  if (!code || !hasSupabaseConfig()) return failed();

  const supabase = await createSupabaseServerClient({ writable: true });
  const exchanged = await supabase.auth.exchangeCodeForSession(code);
  if (exchanged.error) return failed();
  const initialized = await supabase.rpc('initialize_player_save');
  if (initialized.error) return failed();

  return NextResponse.redirect(new URL('/', url.origin));
}
