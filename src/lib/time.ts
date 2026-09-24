import { DateTime, IANAZone } from "luxon";

/**
 * All slot math is done in UTC on the server / in storage. These helpers
 * are the only place local-time conversion happens, and only for display
 * or for turning user input into UTC before it's saved. See docs/PROJECT.md
 * section 5 ("store UTC, display local") for why offsets are never stored.
 */

/**
 * Old IANA names that browsers (Chrome/ICU in particular) still report
 * instead of the current ones. They are valid links to the same zone
 * rules; mapping them just keeps names consistent across the squad.
 */
const LEGACY_ZONE_NAMES: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Europe/Kiev": "Europe/Kyiv",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "Pacific/Truk": "Pacific/Chuuk",
  "Pacific/Ponape": "Pacific/Pohnpei",
};

export function canonicalTimezone(tz: string): string {
  return LEGACY_ZONE_NAMES[tz] ?? tz;
}

export function detectTimezone(): string {
  try {
    return canonicalTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
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
 * "Thu, Sep 24 · 1:16–2:16 PM" in the given zone: the day is named once,
 * and so is AM/PM when both ends share it. A slot that crosses midnight
 * in that zone names the end day too: "Thu, Sep 24 · 10:00 PM – Fri 1:00 AM".
 */
export function formatSlotRange(startIso: string, endIso: string, timezone: string): string {
  const start = DateTime.fromISO(startIso, { zone: "utc" }).setZone(timezone);
  const end = DateTime.fromISO(endIso, { zone: "utc" }).setZone(timezone);
  const day = start.toFormat("ccc, LLL d");

  if (!start.hasSame(end, "day")) {
    return `${day} · ${start.toFormat("h:mm a")} – ${end.toFormat("ccc h:mm a")}`;
  }
  if (start.toFormat("a") === end.toFormat("a")) {
    return `${day} · ${start.toFormat("h:mm")}–${end.toFormat("h:mm a")}`;
  }
  return `${day} · ${start.toFormat("h:mm a")}–${end.toFormat("h:mm a")}`;
}

/**
 * Status for a slot on the board: a countdown while it's upcoming
 * ("in 3h 30m"), and "free now · 45m left" once it has started, which is
 * when people actually need to see it.
 */
export function formatSlotStatus(
  startIso: string,
  endIso: string,
  now: DateTime = DateTime.utc(),
): { live: boolean; label: string } {
  const start = DateTime.fromISO(startIso, { zone: "utc" });
  if (start > now) return { live: false, label: formatCountdown(startIso, now) };

  const left = DateTime.fromISO(endIso, { zone: "utc" })
    .diff(now, ["hours", "minutes"])
    .toObject();
  const hours = Math.trunc(left.hours ?? 0);
  const minutes = Math.trunc(left.minutes ?? 0);
  const remaining = hours > 0 ? `${hours}h ${minutes}m` : `${Math.max(minutes, 1)}m`;
  return { live: true, label: `free now · ${remaining} left` };
}

/**
 * "Kolkata · GMT+5:30": a readable city plus the zone's offset at `at`
 * (so Dublin shows GMT+1 in summer and GMT in winter).
 */
export function formatZoneLabel(timezone: string, at: DateTime = DateTime.utc()): string {
  const zone = canonicalTimezone(timezone);
  if (zone === "UTC" || zone === "Etc/UTC") return "UTC";

  const city = zone.split("/").pop()!.replace(/_/g, " ");
  const offset = at.setZone(zone).offset; // minutes east of UTC
  if (offset === 0) return `${city} · GMT`;

  const sign = offset > 0 ? "+" : "-";
  const h = Math.floor(Math.abs(offset) / 60);
  const m = Math.abs(offset) % 60;
  return `${city} · GMT${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
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
