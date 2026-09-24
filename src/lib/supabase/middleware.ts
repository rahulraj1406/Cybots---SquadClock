import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs on every request and keeps an existing Supabase session fresh
 * (rotating the access token cookie before it expires).
 *
 * It deliberately does NOT create sessions. Anonymous sign-in happens in
 * the create/join Server Actions (see getOrCreateUser), so an identity is
 * only minted when a person actually submits a form. Signing in here
 * made a new anonymous user for every crawler and link-preview bot
 * (WhatsApp fetches every shared invite link), ate into Supabase's
 * per-IP anonymous sign-in rate limit, and silently swallowed the error
 * when anonymous sign-ins were disabled.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Don't remove: getUser() is what triggers the token refresh + cookie
  // write above. It returns immediately when there are no auth cookies.
  await supabase.auth.getUser();

  return response;
}
