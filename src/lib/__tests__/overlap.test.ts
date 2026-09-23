import { describe, expect, it } from "vitest";
import { findOverlaps, fullOverlaps, partialOverlaps } from "../overlap";

describe("findOverlaps", () => {
  it("returns nothing for fewer than two slots", () => {
    expect(findOverlaps([])).toEqual([]);
    expect(
      findOverlaps([
        { member_id: "a", starts_at: "2026-01-01T00:00:00Z", ends_at: "2026-01-01T01:00:00Z" },
      ]),
    ).toEqual([]);
  });

  it("returns nothing when two slots don't touch", () => {
    const windows = findOverlaps([
      { member_id: "a", starts_at: "2026-01-01T00:00:00Z", ends_at: "2026-01-01T01:00:00Z" },
      { member_id: "b", starts_at: "2026-01-01T02:00:00Z", ends_at: "2026-01-01T03:00:00Z" },
    ]);
    expect(windows).toEqual([]);
  });

  it("finds a two-member overlap window", () => {
    const windows = findOverlaps([
      { member_id: "a", starts_at: "2026-01-01T00:00:00Z", ends_at: "2026-01-01T02:00:00Z" },
      { member_id: "b", starts_at: "2026-01-01T01:00:00Z", ends_at: "2026-01-01T03:00:00Z" },
    ]);
    expect(windows).toEqual([
      {
        starts_at: "2026-01-01T01:00:00.000Z",
        ends_at: "2026-01-01T02:00:00.000Z",
        memberIds: ["a", "b"],
      },
    ]);
  });

  it("distinguishes a 2-of-3 window from an all-3 window", () => {
    const windows = findOverlaps([
      { member_id: "a", starts_at: "2026-01-01T00:00:00Z", ends_at: "2026-01-01T04:00:00Z" },
      { member_id: "b", starts_at: "2026-01-01T00:00:00Z", ends_at: "2026-01-01T04:00:00Z" },
      { member_id: "c", starts_at: "2026-01-01T02:00:00Z", ends_at: "2026-01-01T04:00:00Z" },
    ]);

    expect(windows).toHaveLength(2);
    expect(windows[0]).toEqual({
      starts_at: "2026-01-01T00:00:00.000Z",
      ends_at: "2026-01-01T02:00:00.000Z",
      memberIds: ["a", "b"],
    });
    expect(windows[1]).toEqual({
      starts_at: "2026-01-01T02:00:00.000Z",
      ends_at: "2026-01-01T04:00:00.000Z",
      memberIds: ["a", "b", "c"],
    });

    expect(fullOverlaps(windows, 3)).toEqual([windows[1]]);
    expect(partialOverlaps(windows, 3)).toEqual([windows[0]]);
  });

  it("merges adjacent windows that share the same member set", () => {
    // a: 0-3, b: 0-1 and 2-3 (two separate slots for b, same overlap set
    // on both sides of the 1-2 gap where only a is free).
    const windows = findOverlaps([
      { member_id: "a", starts_at: "2026-01-01T00:00:00Z", ends_at: "2026-01-01T03:00:00Z" },
      { member_id: "b", starts_at: "2026-01-01T00:00:00Z", ends_at: "2026-01-01T01:00:00Z" },
      { member_id: "b", starts_at: "2026-01-01T02:00:00Z", ends_at: "2026-01-01T03:00:00Z" },
    ]);
    expect(windows).toHaveLength(2);
    expect(windows.every((w) => w.memberIds.length === 2)).toBe(true);
  });
});
