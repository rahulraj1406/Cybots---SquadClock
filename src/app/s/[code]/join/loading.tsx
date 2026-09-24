import { Card, Eyebrow } from "@/components/ui";

/**
 * The join screen's own skeleton. Without it the parent /s/[code]
 * loading.tsx (a board skeleton) would flash before the join form.
 */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading invite"
      className="flex flex-1 flex-col items-center px-6 py-20 sm:py-28"
    >
      <div className="w-full max-w-sm">
        <Eyebrow>You&rsquo;re joining</Eyebrow>
        <div className="mt-4 h-9 w-56 animate-pulse rounded-card bg-canvas-soft" />
        <Card className="mt-10">
          <div className="h-12 animate-pulse rounded-card bg-canvas-soft" />
          <div className="mt-4 h-12 animate-pulse rounded-card bg-canvas-soft" />
        </Card>
      </div>
    </main>
  );
}
