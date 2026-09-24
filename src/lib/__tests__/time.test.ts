import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import {
  absoluteSlotToUtc,
  formatCountdown,
  formatLocalTime,
  formatSlotRange,
  formatSlotStatus,
  formatZoneLabel,
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

  it("rejects fixed offsets, which can't follow daylight saving", () => {
    expect(isValidTimezone("+05:30")).toBe(false);
    expect(isValidTimezone("-04:00")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("America/Toronto")).toBe(true);
  });

  it("flags a slot as expired once its end has passed", () => {
    const now = DateTime.fromISO("2026-03-01T00:00:00Z", { zone: "utc" });
    expect(isSlotExpired("2026-02-28T00:00:00Z", now)).toBe(true);
    expect(isSlotExpired("2026-03-02T00:00:00Z", now)).toBe(false);
  });
});

describe("formatSlotRange", () => {
  it("names the day once and the meridiem once for a same-day slot", () => {
    expect(
      formatSlotRange("2026-09-24T12:16:00Z", "2026-09-24T13:16:00Z", "Europe/Dublin"),
    ).toBe("Thu, Sep 24 · 1:16–2:16 PM");
  });

  it("keeps both meridiems when the slot crosses noon", () => {
    expect(
      formatSlotRange("2026-09-24T10:00:00Z", "2026-09-24T12:00:00Z", "Europe/Dublin"),
    ).toBe("Thu, Sep 24 · 11:00 AM–1:00 PM");
  });

  it("names the end day when the slot crosses midnight in that zone", () => {
    // 22:00-01:00 in Dublin (IST, UTC+1 in September)
    expect(
      formatSlotRange("2026-09-24T21:00:00Z", "2026-09-25T00:00:00Z", "Europe/Dublin"),
    ).toBe("Thu, Sep 24 · 10:00 PM – Fri 1:00 AM");
  });

  it("renders the same instant differently per zone", () => {
    const [s, e] = ["2026-09-24T12:00:00Z", "2026-09-24T14:00:00Z"];
    expect(formatSlotRange(s, e, "Asia/Kolkata")).toBe("Thu, Sep 24 · 5:30–7:30 PM");
    expect(formatSlotRange(s, e, "America/Toronto")).toBe("Thu, Sep 24 · 8:00–10:00 AM");
  });
});

describe("formatSlotStatus", () => {
  const now = DateTime.fromISO("2026-09-24T12:00:00Z", { zone: "utc" });

  it("counts down to an upcoming slot", () => {
    expect(formatSlotStatus("2026-09-24T15:30:00Z", "2026-09-24T17:00:00Z", now)).toEqual({
      live: false,
      label: "in 3h 30m",
    });
  });

  it("says a slot in progress is live and how long is left", () => {
    expect(formatSlotStatus("2026-09-24T11:00:00Z", "2026-09-24T12:45:00Z", now)).toEqual({
      live: true,
      label: "free now · 45m left",
    });
    expect(formatSlotStatus("2026-09-24T11:00:00Z", "2026-09-24T14:10:00Z", now)).toEqual({
      live: true,
      label: "free now · 2h 10m left",
    });
  });
});

describe("formatZoneLabel", () => {
  it("shows a readable city and the current UTC offset", () => {
    const at = DateTime.fromISO("2026-09-24T12:00:00Z");
    expect(formatZoneLabel("Asia/Kolkata", at)).toBe("Kolkata · GMT+5:30");
    expect(formatZoneLabel("America/Toronto", at)).toBe("Toronto · GMT-4");
    expect(formatZoneLabel("America/Argentina/Buenos_Aires", at)).toBe("Buenos Aires · GMT-3");
  });

  it("maps legacy aliases browsers still report to today's name", () => {
    const at = DateTime.fromISO("2026-09-24T12:00:00Z");
    expect(formatZoneLabel("Asia/Calcutta", at)).toBe("Kolkata · GMT+5:30");
  });

  it("follows daylight saving: Dublin is GMT+1 in summer, GMT in winter", () => {
    expect(formatZoneLabel("Europe/Dublin", DateTime.fromISO("2026-07-01T12:00:00Z"))).toBe(
      "Dublin · GMT+1",
    );
    expect(formatZoneLabel("Europe/Dublin", DateTime.fromISO("2026-12-01T12:00:00Z"))).toBe(
      "Dublin · GMT",
    );
  });

  it("labels UTC plainly", () => {
    expect(formatZoneLabel("UTC")).toBe("UTC");
  });
});
