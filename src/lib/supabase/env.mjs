function serviceOrigin(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if ([url.username, url.password, url.search, url.hash].some(Boolean)) return null;
    if (url.pathname !== '/') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function readSupabaseConfig(environment = process.env) {
  const url = serviceOrigin(environment.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const anonKey = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function hasSupabaseConfig() {
  return readSupabaseConfig() !== null;
}

export function getSupabaseConfig() {
  const config = readSupabaseConfig();
  if (!config) throw new Error('Supabase requires a valid HTTP origin and a nonempty browser key.');
  return config;
}
