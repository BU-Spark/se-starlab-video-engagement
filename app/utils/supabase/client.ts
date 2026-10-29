/**
 * app/utils/supabase/client.ts
 *
 * One browser Supabase client for the whole app (researcher pages and tablet).
 * Uses the publishable key only; returns null when the env vars are missing so both front ends
 * can fall back (researcher: local preview, tablet: mock studies).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const STUDY_MEDIA_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STUDY_BUCKET || 'study-media';

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  client = url && key ? createClient(url, key) : null;
  return client;
}

export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
