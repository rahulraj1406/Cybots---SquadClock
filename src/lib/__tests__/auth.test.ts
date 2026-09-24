import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ANONYMOUS_SIGN_INS_DISABLED_MESSAGE,
  AuthSetupError,
  getOrCreateUser,
} from "../supabase/auth";

function fakeClient({
  existingUser = null,
  signIn = { data: { user: { id: "anon-1" } }, error: null },
}: {
  existingUser?: { id: string } | null;
  signIn?: { data: { user: { id: string } | null }; error: { code?: string; message: string } | null };
} = {}) {
  const signInAnonymously = vi.fn().mockResolvedValue(signIn);
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: existingUser } }),
      signInAnonymously,
    },
  } as unknown as SupabaseClient;
  return { client, signInAnonymously };
}

describe("getOrCreateUser", () => {
  it("returns the existing session's user without signing in again", async () => {
    const { client, signInAnonymously } = fakeClient({ existingUser: { id: "u1" } });

    await expect(getOrCreateUser(client)).resolves.toEqual({ id: "u1" });
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("signs a brand-new device in anonymously", async () => {
    const { client, signInAnonymously } = fakeClient();

    await expect(getOrCreateUser(client)).resolves.toEqual({ id: "anon-1" });
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
  });

  // Regression: this is the exact error a fresh Supabase project returns,
  // because anonymous sign-ins are off by default. It used to be swallowed
  // in the proxy, so squad creation later failed on RLS with an opaque
  // "Minified React error #441" instead of saying what to fix.
  it("explains how to fix a project with anonymous sign-ins disabled", async () => {
    const { client } = fakeClient({
      signIn: {
        data: { user: null },
        error: { code: "anonymous_provider_disabled", message: "Anonymous sign-ins are disabled" },
      },
    });

    const attempt = getOrCreateUser(client);
    await expect(attempt).rejects.toBeInstanceOf(AuthSetupError);
    await expect(attempt).rejects.toThrow(ANONYMOUS_SIGN_INS_DISABLED_MESSAGE);
  });

  it("surfaces any other sign-in failure", async () => {
    const { client } = fakeClient({
      signIn: {
        data: { user: null },
        error: { code: "over_request_rate_limit", message: "Request rate limit reached" },
      },
    });

    await expect(getOrCreateUser(client)).rejects.toThrow(/Request rate limit reached/);
  });
});
