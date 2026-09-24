"use client";

import { useActionState } from "react";
import { deleteSlot } from "@/lib/actions";
import { formatCountdown, formatLocalDate, formatLocalTime } from "@/lib/time";
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

  return (
    <div className="flex items-start justify-between gap-3 border-b border-hairline py-3 last:border-0">
      <div>
        <p className="text-sm text-ink">
          {formatLocalDate(slot.starts_at, viewerTimezone)}{" "}
          {formatLocalTime(slot.starts_at, viewerTimezone)}–
          {formatLocalTime(slot.ends_at, viewerTimezone)}
          <span className="ml-2 font-mono text-xs uppercase tracking-[1.2px] text-mute">
            {formatCountdown(slot.starts_at)}
          </span>
        </p>
        <p className="mt-1 text-xs text-mute">
          {formatLocalTime(slot.starts_at, slot.member.timezone)}–
          {formatLocalTime(slot.ends_at, slot.member.timezone)} their time
          {slot.note ? ` · "${slot.note}"` : ""}
        </p>
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
              <span className="text-xs text-mute">{member.timezone}</span>
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
