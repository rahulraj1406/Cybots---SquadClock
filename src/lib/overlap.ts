import type { OverlapWindow, Slot } from "./types";

type OverlapInput = Pick<Slot, "member_id" | "starts_at" | "ends_at">;

/**
 * Sweep-line overlap finder. Every slot boundary (start or end) is a
 * candidate breakpoint; between two consecutive breakpoints the set of
 * "currently free" members is constant, so we only need to evaluate
 * coverage once per sub-interval rather than per instant.
 *
 * Returns one window per maximal-length span with a *constant* set of
 * >=2 overlapping members (adjacent spans with the same member set are
 * merged so a squad board doesn't show artificial seams).
 */
export function findOverlaps(slots: OverlapInput[]): OverlapWindow[] {
  if (slots.length < 2) return [];

  const boundaries = new Set<number>();
  for (const slot of slots) {
    boundaries.add(Date.parse(slot.starts_at));
    boundaries.add(Date.parse(slot.ends_at));
  }
  const points = [...boundaries].sort((a, b) => a - b);

  const raw: { starts_at: number; ends_at: number; memberIds: string[] }[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const spanStart = points[i];
    const spanEnd = points[i + 1];
    if (spanStart === spanEnd) continue;

    const active = new Set<string>();
    for (const slot of slots) {
      const s = Date.parse(slot.starts_at);
      const e = Date.parse(slot.ends_at);
      if (s <= spanStart && e >= spanEnd) active.add(slot.member_id);
    }

    if (active.size >= 2) {
      raw.push({ starts_at: spanStart, ends_at: spanEnd, memberIds: [...active].sort() });
    }
  }

  const merged: typeof raw = [];
  for (const window of raw) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.ends_at === window.starts_at &&
      sameMembers(prev.memberIds, window.memberIds)
    ) {
      prev.ends_at = window.ends_at;
    } else {
      merged.push({ ...window });
    }
  }

  return merged.map((w) => ({
    starts_at: new Date(w.starts_at).toISOString(),
    ends_at: new Date(w.ends_at).toISOString(),
    memberIds: w.memberIds,
  }));
}

function sameMembers(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, i) => id === b[i]);
}

/** Windows where every member of the squad is free, sorted soonest-first. */
export function fullOverlaps(
  windows: OverlapWindow[],
  totalMemberCount: number,
): OverlapWindow[] {
  return windows
    .filter((w) => w.memberIds.length === totalMemberCount)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}

/** Windows where 2+ but not all members are free, sorted soonest-first. */
export function partialOverlaps(
  windows: OverlapWindow[],
  totalMemberCount: number,
): OverlapWindow[] {
  return windows
    .filter((w) => w.memberIds.length >= 2 && w.memberIds.length < totalMemberCount)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}
