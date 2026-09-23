import { redirect, notFound } from "next/navigation";
import { getCurrentMember, getSquadBoardData, getSquadByInviteCode } from "@/lib/squad";
import { SquadBoard } from "@/components/SquadBoard";

export default async function SquadPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
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
