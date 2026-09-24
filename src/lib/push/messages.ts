import { DateTime } from "luxon";
import { findOverlaps, fullOverlaps } from "@/lib/overlap";
import { formatSlotRange } from "@/lib/time";
import type { Member, Slot } from "@/lib/types";

/** What the service worker shows (see public/sw.js). */
export type PushPayload = {
  title: string;
  body: string;
  url: string;
  /** Same tag = the newer notification replaces the older one. */
  tag: string;
};

type PlanMember = Pick<Member, "id" | "display_name" | "timezone">;
type PlanSlot = Pick<Slot, "id" | "member_id" | "starts_at" | "ends_at">;

/** A slot starting within this long counts as "free now". */
const FREE_NOW_WINDOW_MINUTES = 5;

function durationLabel(startIso: string, endIso: string): string {
  const minutes = Math.round(
    DateTime.fromISO(endIso).diff(DateTime.fromISO(startIso), "minutes").minutes,
  );
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Decides who gets which notification after `newSlot` is posted. Pure,
 * so it's unit-tested; lib/push/send.ts does the database and network
 * work. The two alerts from docs/PROJECT.md, each in the recipient's
 * own time:
 * - the new slot completes a window where the WHOLE squad is free:
 *   "Everyone in <squad> is free together", with the window, or
 * - otherwise, if the slot starts now: "<name> is free now".
 * A slot for later that completes no full overlap sends nothing, so
 * planning ahead doesn't spam anyone. The poster is never notified.
 */
export function planSlotNotifications(input: {
  squadName: string;
  boardUrl: string;
  members: PlanMember[];
  newSlot: PlanSlot;
  activeSlots: PlanSlot[];
  now?: DateTime;
}): { memberId: string; payload: PushPayload }[] {
  const { squadName, boardUrl, members, newSlot, activeSlots } = input;
  const now = input.now ?? DateTime.utc();
  if (members.length < 2) return [];

  const poster = members.find((m) => m.id === newSlot.member_id);
  if (!poster) return [];
  const recipients = members.filter((m) => m.id !== poster.id);

  const newStart = Date.parse(newSlot.starts_at);
  const newEnd = Date.parse(newSlot.ends_at);
  const everyone = fullOverlaps(findOverlaps(activeSlots), members.length).find(
    (w) =>
      w.memberIds.includes(poster.id) &&
      Date.parse(w.starts_at) < newEnd &&
      Date.parse(w.ends_at) > newStart,
  );

  if (everyone) {
    return recipients.map((m) => ({
      memberId: m.id,
      payload: {
        title: `Everyone in ${squadName} is free together`,
        body: `${formatSlotRange(everyone.starts_at, everyone.ends_at, m.timezone)} your time`,
        url: boardUrl,
        tag: `overlap-${everyone.starts_at}`,
      },
    }));
  }

  const startsSoon =
    DateTime.fromISO(newSlot.starts_at, { zone: "utc" }) <=
    now.plus({ minutes: FREE_NOW_WINDOW_MINUTES });
  if (!startsSoon) return [];

  const duration = durationLabel(newSlot.starts_at, newSlot.ends_at);
  return recipients.map((m) => ({
    memberId: m.id,
    payload: {
      title: `${poster.display_name} is free now`,
      body:
        `For ${duration}, until ` +
        `${DateTime.fromISO(newSlot.ends_at, { zone: "utc" }).setZone(m.timezone).toFormat("h:mm a")}` +
        ` your time · ${squadName}`,
      url: boardUrl,
      tag: `slot-${newSlot.id}`,
    },
  }));
}
