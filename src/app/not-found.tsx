import Link from "next/link";
import { Eyebrow } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <Eyebrow>404</Eyebrow>
      <h1 className="mt-3 font-sans text-3xl tracking-[-0.02em] text-ink">
        No squad here
      </h1>
      <p className="mt-3 max-w-sm text-sm text-body">
        That invite link doesn&rsquo;t match a squad. Double-check the link,
        or start a new one.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center justify-center rounded-pill bg-primary px-4 py-2 text-sm text-on-primary hover:bg-ink-hover"
      >
        Back to SquadClock
      </Link>
    </main>
  );
}
