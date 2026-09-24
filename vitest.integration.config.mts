import { defineConfig } from "vitest/config";
import { execSync } from "node:child_process";
import path from "node:path";

/**
 * Fills SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
 * from a running local stack
 * (`npx supabase start`) unless they're already set, e.g. in CI.
 */
function localSupabaseEnv(): Record<string, string> {
  if (process.env.SUPABASE_ANON_KEY) return {};
  try {
    const status = JSON.parse(
      execSync("npx supabase status -o json", { stdio: ["ignore", "pipe", "ignore"] }).toString(),
    );
    return {
      SUPABASE_URL: status.API_URL,
      SUPABASE_ANON_KEY: status.ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    };
  } catch {
    return {}; // rls.test.ts explains how to start the stack
  }
}

// Runs tests/integration against a real Supabase stack (see README,
// "Integration tests"). Kept separate from `npm test` so unit tests stay
// fast and need no Docker.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    env: localSupabaseEnv(),
    testTimeout: 30_000,
    hookTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
