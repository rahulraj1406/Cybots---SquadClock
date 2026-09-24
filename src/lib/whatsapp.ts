import { formatShortRange, formatSlotRange, zoneCity } from "./time";
import type { Member } from "./types";

export type ShareLine = {
  member: Pick<Member, "display_name" | "timezone">;
  starts_at: string;
  ends_at: string;
};

/**
 * Builds the pre-filled "Share to WhatsApp" message: one line per member,
 * in that member's own local time, plus the invite link. See docs/PROJECT.md
 * section 7 for the target format.
 */
export function buildWhatsappMessage(input: {
  ownerName: string;
  lines: ShareLine[];
  inviteUrl: string;
  note?: string | null;
}): string {
  const { ownerName, lines, inviteUrl, note } = input;
  const owner = lines.find((l) => l.member.display_name === ownerName) ?? lines[0];

  const header = owner
    ? `🎮 ${ownerName} is free ${formatSlotRange(owner.starts_at, owner.ends_at, owner.member.timezone)}` +
      ` (${zoneCity(owner.member.timezone)} time)`
    : `🎮 ${ownerName} posted a slot`;

  const body = lines
    .map(
      (l) =>
        `${l.member.display_name}: ${formatShortRange(l.starts_at, l.ends_at, l.member.timezone)}` +
        ` (${zoneCity(l.member.timezone)})`,
    )
    .join("\n");

  const noteLine = note ? `\n“${note}”` : "";

  return `${header}${noteLine}\n\n${body}\n\nJoin the squad: ${inviteUrl}`;
}

/** Builds the share message for an overlap window (see OverlapBanner). */
export function buildOverlapMessage(input: {
  starts_at: string;
  ends_at: string;
  members: Pick<Member, "id" | "display_name" | "timezone">[];
  totalMemberCount: number;
  inviteUrl: string;
}): string {
  const { starts_at, ends_at, members, totalMemberCount, inviteUrl } = input;
  const isFull = members.length === totalMemberCount;

  const header = isFull
    ? `🎮 All ${totalMemberCount} of us are free at the same time!`
    : `🎮 ${members.length} of ${totalMemberCount} are free at the same time`;

  const body = members
    .map(
      (m) =>
        `${m.display_name}: ${formatShortRange(starts_at, ends_at, m.timezone)}` +
        ` (${zoneCity(m.timezone)})`,
    )
    .join("\n");

  return `${header}\n\n${body}\n\nJoin the squad: ${inviteUrl}`;
}

export function whatsappShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
