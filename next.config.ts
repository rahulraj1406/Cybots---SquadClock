import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root explicitly — there's an unrelated
  // package-lock.json in the parent (home) directory that Next.js would
  // otherwise mistake for a monorepo root.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
