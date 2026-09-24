import { CreateSquadForm } from "@/components/CreateSquadForm";
import { JoinByCodeForm } from "@/components/JoinByCodeForm";
import { YourSquads } from "@/components/YourSquads";
import { Card, Eyebrow } from "@/components/ui";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-20 sm:py-28">
      <div className="w-full max-w-sm">
        <Eyebrow>Squad availability</Eyebrow>
        <h1 className="mt-3 font-sans text-4xl leading-[1.05] tracking-[-0.02em] text-ink sm:text-5xl">
          Say &ldquo;I&rsquo;m free&rdquo; once.
        </h1>
        <p className="mt-4 text-base leading-7 text-body">
          Everyone sees it in their own time zone. No more doing the math by
          hand.
        </p>

        <YourSquads />

        <Card className="mt-10">
          <CreateSquadForm />
        </Card>

        <div className="mt-10 flex items-center gap-4 text-mute">
          <div className="h-px flex-1 bg-hairline" />
          <span className="font-mono text-xs uppercase tracking-[1.2px]">
            or
          </span>
          <div className="h-px flex-1 bg-hairline" />
        </div>

        <Card className="mt-10">
          <p className="mb-4 text-sm text-body">Already have an invite?</p>
          <JoinByCodeForm />
        </Card>
      </div>
    </main>
  );
}
