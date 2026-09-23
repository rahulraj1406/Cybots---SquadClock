import { notFound, redirect } from "next/navigation";
import { getCurrentMember, getSquadByInviteCode } from "@/lib/squad";
import { JoinForm } from "@/components/JoinForm";
import { Card, Eyebrow } from "@/components/ui";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const squad = await getSquadByInviteCode(code);
  if (!squad) notFound();

  const existingMember = await getCurrentMember(squad.id);
  if (existingMember) redirect(`/s/${code}`);

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-20 sm:py-28">
      <div className="w-full max-w-sm">
        <Eyebrow>You&rsquo;re joining</Eyebrow>
        <h1 className="mt-3 font-sans text-4xl leading-[1.05] tracking-[-0.02em] text-ink">
          {squad.name}
        </h1>
        <Card className="mt-10">
          <JoinForm squadId={squad.id} inviteCode={code} />
        </Card>
      </div>
    </main>
  );
}
