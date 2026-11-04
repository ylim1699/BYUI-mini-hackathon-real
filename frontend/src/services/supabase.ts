import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** `npm run dev:mock`: sample data and fake server, for local development only. */
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = !USE_MOCKS && url && key ? createClient(url, key) : null;

export async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
