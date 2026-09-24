import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Shown when the Supabase project has "Anonymous Sign-Ins" switched off
 * (which is Supabase's default for new projects). Without it no device
 * can get an identity, so every RLS policy that checks auth.uid() — i.e.
 * creating or joining a squad — rejects the write.
 */
export const ANONYMOUS_SIGN_INS_DISABLED_MESSAGE =
  "Anonymous sign-ins are turned off for this Supabase project. " +
  "Enable them in Supabase → Authentication → Sign In / Providers → " +
  "“Allow anonymous sign-ins”, then try again.";

export class AuthSetupError extends Error {}

/**
 * Returns the device's user, signing it in anonymously first if it has
 * no session yet. Only called from Server Actions (create/join), so an
 * identity is created when a real person submits a form — not for every
 * crawler or link-preview bot that happens to load a page.
 */
export async function getOrCreateUser(supabase: SupabaseClient): Promise<User> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user;

  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) {
    if (error.code === "anonymous_provider_disabled") {
      throw new AuthSetupError(ANONYMOUS_SIGN_INS_DISABLED_MESSAGE);
    }
    throw new AuthSetupError(`Couldn't start a session: ${error.message}`);
  }
  if (!data.user) {
    throw new AuthSetupError("Couldn't start a session. Please try again.");
  }

  return data.user;
}
