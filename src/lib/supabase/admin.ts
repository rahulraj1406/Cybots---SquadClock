import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client: bypasses RLS. Server-only, and used for exactly
 * one job: reading squadmates' push subscriptions to deliver
 * notifications, which RLS rightly hides from every other member.
 * The key comes from SUPABASE_SERVICE_ROLE_KEY and must never get a
 * NEXT_PUBLIC_ prefix.
 */
export function createAdminClient(serviceRoleKey: string) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
