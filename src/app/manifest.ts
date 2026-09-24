import type { MetadataRoute } from "next";

/**
 * Makes SquadClock installable ("Add to Home Screen"), step 10 of
 * docs/PROJECT.md. Installing is also what lets iPhones (iOS 16.4+)
 * receive web push later, in Phase 2.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SquadClock",
    short_name: "SquadClock",
    description: "Say “I'm free” once. Your squad sees it in their own time zone.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
