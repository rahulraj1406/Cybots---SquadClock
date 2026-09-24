import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getCurrentMember, getSquadBoardData, getSquadByInviteCode } from "@/lib/squad";
import { SquadBoard } from "@/components/SquadBoard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const squad = await getSquadByInviteCode(code.toLowerCase());
  if (!squad) return { title: "Squad not found · SquadClock" };

  return {
    title: `${squad.name} · SquadClock`,
    description: `See when ${squad.name} is free, in your own time zone.`,
    openGraph: {
      title: `${squad.name}`,
      description: `See when ${squad.name} is free, in your own time zone.`,
    },
    // Invite links are private to a squad; keep them out of search results.
    robots: { index: false, follow: false },
  };
}

export default async function SquadPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  // Invite codes are generated lowercase; phones auto-capitalise them.
  const code = rawCode.toLowerCase();
  if (code !== rawCode) redirect(`/s/${code}`);

  const squad = await getSquadByInviteCode(code);
  if (!squad) notFound();

  const member = await getCurrentMember(squad.id);
  if (!member) redirect(`/s/${code}/join`);

  const { members, slots } = await getSquadBoardData(squad.id);

  return (
    <SquadBoard
      squadName={squad.name}
      squadId={squad.id}
      inviteCode={code}
      currentMemberId={member.id}
      viewerTimezone={member.timezone}
      initialMembers={members}
      initialSlots={slots}
    />
  );
}
