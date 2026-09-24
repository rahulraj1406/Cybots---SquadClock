import { Card, Eyebrow } from "@/components/ui";

/** Skeleton for the squad board while the server loads members and slots. */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading squad"
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12"
    >
      <div>
        <Eyebrow>Squad</Eyebrow>
        <div className="mt-2 h-8 w-48 animate-pulse rounded-card bg-canvas-soft" />
      </div>
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 w-32 animate-pulse rounded-pill bg-canvas-soft" />
        ))}
      </div>
      {[0, 1].map((i) => (
        <Card key={i}>
          <div className="h-3 w-24 animate-pulse rounded bg-canvas-soft" />
          <div className="mt-4 h-4 w-64 max-w-full animate-pulse rounded bg-canvas-soft" />
        </Card>
      ))}
    </main>
  );
}
