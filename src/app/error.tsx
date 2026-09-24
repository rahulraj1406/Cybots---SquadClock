"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, Eyebrow } from "@/components/ui";

/**
 * In production React replaces a server error's message with a generic
 * "Minified React error #441 ..." / "An error occurred in the Server
 * Components render" string. Showing that as a headline told users
 * nothing, so only show messages that aren't that placeholder, and give
 * the digest (which matches the entry in Vercel's function logs) as a
 * reference.
 */
function isOpaqueServerMessage(message: string | undefined): boolean {
  return (
    !message ||
    message.includes("Minified React error") ||
    message.includes("Server Components render")
  );
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message = isOpaqueServerMessage(error.message)
    ? "Something went wrong on our side. Try again in a moment."
    : error.message;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <Eyebrow>Something went wrong</Eyebrow>
      <h1 className="mt-3 max-w-md font-sans text-2xl tracking-[-0.02em] text-ink">
        {message}
      </h1>
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-mute">Reference: {error.digest}</p>
      )}
      <div className="mt-8 flex items-center gap-3">
        <Button variant="primary" onClick={() => reset()}>
          Try again
        </Button>
        <Link
          href="/"
          className="inline-flex items-center rounded-pill border border-hairline-strong px-4 py-2 text-sm text-ink hover:bg-canvas-soft"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
