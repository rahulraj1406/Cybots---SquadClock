import { DateTime, IANAZone } from "luxon";

/**
 * All slot math is done in UTC on the server / in storage. These helpers
 * are the only place local-time conversion happens, and only for display
 * or for turning user input into UTC before it's saved. See docs/PROJECT.md
 * section 5 ("store UTC, display local") for why offsets are never stored.
 */

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * True only for IANA zone names ("Asia/Kolkata", "UTC"). Fixed offsets
 * like "+05:30" are rejected even though Luxon/Intl accept them: an
 * offset can't follow daylight-saving changes, which is the whole reason
 * we store zone names (docs/PROJECT.md section 5).
 */
export function isValidTimezone(tz: string): boolean {
  if (!/^[A-Za-z]/.test(tz)) return false;
  try {
    return IANAZone.isValidZone(tz);
  } catch {
    return false;
  }
}

/** "Sun 3:00 PM" in the given timezone, for an ISO UTC instant. */
export function formatLocalTime(isoUtc: string, timezone: string): string {
  return DateTime.fromISO(isoUtc, { zone: "utc" })
    .setZone(timezone)
    .toFormat("ccc h:mm a");
}

/** "Sun, Mar 8" in the given timezone, for an ISO UTC instant. */
export function formatLocalDate(isoUtc: string, timezone: string): string {
  return DateTime.fromISO(isoUtc, { zone: "utc" })
    .setZone(timezone)
    .toFormat("ccc, LLL d");
}

/**
 * "in 16h", "in 2d 4h", "now", "ended 3h ago" — relative to `now`
 * (defaults to the current instant; pass one in for deterministic tests).
 */
export function formatCountdown(
  isoUtc: string,
  now: DateTime = DateTime.utc(),
): string {
  const target = DateTime.fromISO(isoUtc, { zone: "utc" });
  const forwardMinutes = target.diff(now, "minutes").minutes;

  if (forwardMinutes >= 0 && forwardMinutes < 1) return "now";

  if (forwardMinutes >= 1) {
    const diff = target.diff(now, ["days", "hours", "minutes"]).toObject();
    const days = Math.trunc(diff.days ?? 0);
    const hours = Math.trunc(diff.hours ?? 0);
    const minutes = Math.trunc(diff.minutes ?? 0);
    if (days > 0) return `in ${days}d ${hours}h`;
    if (hours > 0) return `in ${hours}h ${minutes}m`;
    return `in ${minutes}m`;
  }

  const ago = now.diff(target, ["days", "hours", "minutes"]).toObject();
  const agoDays = Math.trunc(ago.days ?? 0);
  const agoHours = Math.trunc(ago.hours ?? 0);
  if (agoDays === 0 && agoHours === 0) return "just now";
  if (agoDays > 0) return `${agoDays}d ${agoHours}h ago`;
  return `${agoHours}h ago`;
}

/** Turns "free now for 2h" / "free in 16h for 3h" into UTC bounds. */
export function relativeSlotToUtc(
  input: { startInHours: number; durationHours: number },
  now: DateTime = DateTime.utc(),
): { starts_at: string; ends_at: string } {
  const starts = now.plus({ hours: input.startInHours });
  const ends = starts.plus({ hours: input.durationHours });
  return { starts_at: starts.toUTC().toISO()!, ends_at: ends.toUTC().toISO()! };
}

/** Turns a date + wall-clock time picked in `timezone` into UTC bounds. */
export function absoluteSlotToUtc(input: {
  dateISO: string; // "2026-03-08"
  timeHHmm: string; // "08:00"
  durationHours: number;
  timezone: string;
}): { starts_at: string; ends_at: string } {
  const [hour, minute] = input.timeHHmm.split(":").map(Number);
  const starts = DateTime.fromISO(input.dateISO, { zone: input.timezone }).set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  });
  const ends = starts.plus({ hours: input.durationHours });
  return { starts_at: starts.toUTC().toISO()!, ends_at: ends.toUTC().toISO()! };
}

export function isSlotExpired(
  endsAtIsoUtc: string,
  now: DateTime = DateTime.utc(),
): boolean {
  return DateTime.fromISO(endsAtIsoUtc, { zone: "utc" }) <= now;
}
