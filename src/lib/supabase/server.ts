import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for use in Server Components / Server Actions. Reads
 * and writes the auth cookie set by middleware.ts, so the anonymous
 * session established there is visible here too.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render, not an action/route
            // handler — cookies can't be written here. Middleware already
            // refreshes the session on every request, so this is safe to
            // ignore (see the @supabase/ssr Next.js guide).
          }
        },
      },
    },
  );
}
