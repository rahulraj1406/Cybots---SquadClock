"use client";

import { Button, Eyebrow } from "@/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <Eyebrow>Something went wrong</Eyebrow>
      <h1 className="mt-3 font-sans text-3xl tracking-[-0.02em] text-ink">
        {error.message || "Unexpected error"}
      </h1>
      <Button variant="primary" className="mt-8" onClick={() => reset()}>
        Try again
      </Button>
    </main>
  );
}
