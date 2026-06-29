import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let cached: SupabaseClient | null | undefined;

// 管理画面は Supabase が必須。未設定なら null（UI側で案内を表示）。
export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  cached = isSupabaseConfigured
    ? createClient(url!, anonKey!, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : null;
  return cached;
}
