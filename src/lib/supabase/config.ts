// Supabase is optional: without these env vars the app runs in local mode (no login, nothing saved).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const supabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);
