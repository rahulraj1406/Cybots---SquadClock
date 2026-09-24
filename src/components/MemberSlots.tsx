"use client";

import { useActionState } from "react";
import { deleteSlot } from "@/lib/actions";
import {
  canonicalTimezone,
  formatSlotRange,
  formatSlotStatus,
  formatZoneLabel,
} from "@/lib/time";
import { buildWhatsappMessage } from "@/lib/whatsapp";
import type { ActionState, Member, SlotWithMember } from "@/lib/types";
import { Card, Eyebrow } from "@/components/ui";
import { ShareButton } from "@/components/ShareButton";

const initialState: ActionState = { error: null };

function RemoveSlotButton({ slotId, inviteCode }: { slotId: string; inviteCode: string }) {
  const [state, formAction, pending] = useActionState(deleteSlot, initialState);

  return (
    <form action={formAction} className="flex flex-col items-end">
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="inviteCode" value={inviteCode} />
      <button
        type="submit"
        disabled={pending}
        className="font-mono text-xs uppercase tracking-[1.2px] text-mute hover:text-sunset disabled:opacity-40"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {state.error && (
        <p aria-live="polite" className="mt-1 max-w-40 text-right text-xs text-sunset">
          {state.error}
        </p>
      )}
    </form>
  );
}

function SlotRow({
  slot,
  viewerTimezone,
  currentMemberId,
  inviteCode,
  inviteUrl,
  allMembers,
}: {
  slot: SlotWithMember;
  viewerTimezone: string;
  currentMemberId: string;
  inviteCode: string;
  inviteUrl: string;
  allMembers: Member[];
}) {
  const isMine = slot.member_id === currentMemberId;
  const message = buildWhatsappMessage({
    ownerName: slot.member.display_name,
    inviteUrl,
    note: slot.note,
    lines: allMembers.map((m) => ({
      member: m,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
    })),
  });

  const status = formatSlotStatus(slot.starts_at, slot.ends_at);
  // Only worth a second line when the owner's wall clock differs from ours.
  const showTheirTime =
    canonicalTimezone(slot.member.timezone) !== canonicalTimezone(viewerTimezone);

  return (
    <div className="flex flex-col gap-3 border-b border-hairline py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm text-ink">{formatSlotRange(slot.starts_at, slot.ends_at, viewerTimezone)}</p>
        <p
          suppressHydrationWarning
          className={`mt-1 flex items-center gap-2 font-mono text-xs uppercase tracking-[1.2px] ${
            status.live ? "text-live" : "text-mute"
          }`}
        >
          {status.live && <span className="h-1.5 w-1.5 rounded-full bg-live" aria-hidden />}
          {status.label}
        </p>
        {(showTheirTime || slot.note) && (
          <p className="mt-1 text-xs text-mute">
            {showTheirTime &&
              `${formatSlotRange(slot.starts_at, slot.ends_at, slot.member.timezone)} their time`}
            {showTheirTime && slot.note ? " · " : ""}
            {slot.note ? `“${slot.note}”` : ""}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <ShareButton message={message} label="Share" />
        {isMine && <RemoveSlotButton slotId={slot.id} inviteCode={inviteCode} />}
      </div>
    </div>
  );
}

export function MemberSlots({
  members,
  slots,
  viewerTimezone,
  currentMemberId,
  inviteCode,
  inviteUrl,
}: {
  members: Member[];
  slots: SlotWithMember[];
  viewerTimezone: string;
  currentMemberId: string;
  inviteCode: string;
  inviteUrl: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {members.map((member) => {
        const memberSlots = slots
          .filter((s) => s.member_id === member.id)
          .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));

        return (
          <Card key={member.id}>
            <div className="flex items-center justify-between">
              <Eyebrow>
                {member.display_name}
                {member.id === currentMemberId ? " (you)" : ""}
              </Eyebrow>
              <span className="text-xs text-mute" title={member.timezone} suppressHydrationWarning>
                {formatZoneLabel(member.timezone)}
              </span>
            </div>
            {memberSlots.length === 0 ? (
              <p className="mt-3 text-sm text-mute">No upcoming slots</p>
            ) : (
              <div className="mt-2">
                {memberSlots.map((slot) => (
                  <SlotRow
                    key={slot.id}
                    slot={slot}
                    viewerTimezone={viewerTimezone}
                    currentMemberId={currentMemberId}
                    inviteCode={inviteCode}
                    inviteUrl={inviteUrl}
                    allMembers={members}
                  />
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
