import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import {
  absoluteSlotToUtc,
  formatCountdown,
  formatLocalTime,
  isSlotExpired,
  isValidTimezone,
  relativeSlotToUtc,
} from "../time";

describe("relativeSlotToUtc", () => {
  it("converts 'free now for 2h' relative to a fixed instant", () => {
    const now = DateTime.fromISO("2026-03-01T00:00:00Z", { zone: "utc" });
    const { starts_at, ends_at } = relativeSlotToUtc(
      { startInHours: 0, durationHours: 2 },
      now,
    );
    expect(starts_at).toBe("2026-03-01T00:00:00.000Z");
    expect(ends_at).toBe("2026-03-01T02:00:00.000Z");
  });

  it("converts 'free in 16h for 3h'", () => {
    const now = DateTime.fromISO("2026-03-01T00:00:00Z", { zone: "utc" });
    const { starts_at, ends_at } = relativeSlotToUtc(
      { startInHours: 16, durationHours: 3 },
      now,
    );
    expect(starts_at).toBe("2026-03-01T16:00:00.000Z");
    expect(ends_at).toBe("2026-03-01T19:00:00.000Z");
  });
});

describe("absoluteSlotToUtc", () => {
  it("converts a local wall-clock time to UTC", () => {
    // 8 AM in India (UTC+5:30) on a fixed date is 2:30 AM UTC.
    const { starts_at } = absoluteSlotToUtc({
      dateISO: "2026-03-08",
      timeHHmm: "08:00",
      durationHours: 2,
      timezone: "Asia/Kolkata",
    });
    expect(starts_at).toBe("2026-03-08T02:30:00.000Z");
  });

  it("stays correct across the Dublin DST change (Oct 25 2026)", () => {
    // Dublin goes from IST (UTC+1) to GMT (UTC+0) at 02:00 local on Oct 25 2026.
    const before = absoluteSlotToUtc({
      dateISO: "2026-10-24",
      timeHHmm: "20:00",
      durationHours: 1,
      timezone: "Europe/Dublin",
    });
    const after = absoluteSlotToUtc({
      dateISO: "2026-10-26",
      timeHHmm: "20:00",
      durationHours: 1,
      timezone: "Europe/Dublin",
    });
    expect(before.starts_at).toBe("2026-10-24T19:00:00.000Z");
    expect(after.starts_at).toBe("2026-10-26T20:00:00.000Z");
  });
});

describe("formatCountdown", () => {
  const now = DateTime.fromISO("2026-03-01T00:00:00Z", { zone: "utc" });

  it("shows 'now' for the current instant", () => {
    expect(formatCountdown("2026-03-01T00:00:00Z", now)).toBe("now");
  });

  it("shows hours and minutes for a same-day slot", () => {
    expect(formatCountdown("2026-03-01T05:30:00Z", now)).toBe("in 5h 30m");
  });

  it("shows days and hours for a multi-day slot", () => {
    expect(formatCountdown("2026-03-03T04:00:00Z", now)).toBe("in 2d 4h");
  });

  it("shows elapsed time for a past slot", () => {
    expect(formatCountdown("2026-02-27T20:00:00Z", now)).toBe("1d 4h ago");
  });
});

describe("formatLocalTime", () => {
  it("renders an ISO UTC instant in the target timezone", () => {
    expect(formatLocalTime("2026-03-08T02:30:00Z", "Asia/Kolkata")).toBe(
      "Sun 8:00 AM",
    );
  });
});

describe("isValidTimezone / isSlotExpired", () => {
  it("accepts IANA names and rejects garbage", () => {
    expect(isValidTimezone("Asia/Kolkata")).toBe(true);
    expect(isValidTimezone("not/a/zone")).toBe(false);
  });

  it("flags a slot as expired once its end has passed", () => {
    const now = DateTime.fromISO("2026-03-01T00:00:00Z", { zone: "utc" });
    expect(isSlotExpired("2026-02-28T00:00:00Z", now)).toBe(true);
    expect(isSlotExpired("2026-03-02T00:00:00Z", now)).toBe(false);
  });
});
