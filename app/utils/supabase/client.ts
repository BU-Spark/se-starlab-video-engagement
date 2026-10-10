/**
 * app/utils/supabase/client.ts
 *
 * Supabase client for Client Components (runs in the browser).
 * Uses the publishable key, so access is governed by Row Level Security.
 *
 * For example:
 * import { createClient } from '@/app/utils/supabase/client';
 */

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
