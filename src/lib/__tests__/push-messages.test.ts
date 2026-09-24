import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { planSlotNotifications } from "../push/messages";

const now = DateTime.fromISO("2026-09-27T14:00:00Z", { zone: "utc" });
const at = (iso: string) => DateTime.fromISO(iso, { zone: "utc" }).toISO()!;

const rahul = { id: "r", display_name: "Rahul", timezone: "Europe/Dublin" };
const arjun = { id: "a", display_name: "Arjun", timezone: "Asia/Kolkata" };
const maya = { id: "m", display_name: "Maya", timezone: "America/Toronto" };
const members = [rahul, arjun, maya];

const slot = (id: string, member_id: string, starts: string, ends: string) => ({
  id,
  member_id,
  starts_at: at(starts),
  ends_at: at(ends),
});

const base = { squadName: "Brawl crew", boardUrl: "https://x.test/s/abc", members, now };

describe("planSlotNotifications", () => {
  it("tells everyone else, in their own time, when someone is free now", () => {
    const newSlot = slot("s1", "r", "2026-09-27T14:00:00Z", "2026-09-27T16:00:00Z");
    const plan = planSlotNotifications({ ...base, newSlot, activeSlots: [newSlot] });

    expect(plan.map((p) => p.memberId)).toEqual(["a", "m"]); // never the poster
    expect(plan[0].payload).toEqual({
      title: "Rahul is free now",
      body: "For 2h, until 9:30 PM your time · Brawl crew",
      url: "https://x.test/s/abc",
      tag: "slot-s1",
    });
    expect(plan[1].payload.body).toBe("For 2h, until 12:00 PM your time · Brawl crew");
  });

  it("stays quiet for a slot that starts later and overlaps nobody", () => {
    const newSlot = slot("s1", "r", "2026-09-28T08:00:00Z", "2026-09-28T10:00:00Z");
    expect(planSlotNotifications({ ...base, newSlot, activeSlots: [newSlot] })).toEqual([]);
  });

  it("announces a new whole-squad overlap instead of 'free now'", () => {
    const a = slot("s1", "a", "2026-09-27T13:00:00Z", "2026-09-27T17:00:00Z");
    const m = slot("s2", "m", "2026-09-27T14:30:00Z", "2026-09-27T18:00:00Z");
    const newSlot = slot("s3", "r", "2026-09-27T14:00:00Z", "2026-09-27T16:00:00Z");

    const plan = planSlotNotifications({ ...base, newSlot, activeSlots: [a, m, newSlot] });

    expect(plan.map((p) => p.memberId)).toEqual(["a", "m"]);
    expect(plan[0].payload).toMatchObject({
      title: "Everyone in Brawl crew is free together",
      body: "Sun, Sep 27 · 8:00–9:30 PM your time",
      tag: "overlap-2026-09-27T14:30:00.000Z",
    });
    expect(plan[1].payload.body).toBe("Sun, Sep 27 · 10:30 AM–12:00 PM your time");
  });

  it("uses 'free now' when the overlap only covers part of the squad", () => {
    const a = slot("s1", "a", "2026-09-27T13:00:00Z", "2026-09-27T17:00:00Z");
    const newSlot = slot("s3", "r", "2026-09-27T14:00:00Z", "2026-09-27T16:00:00Z");

    const plan = planSlotNotifications({ ...base, newSlot, activeSlots: [a, newSlot] });
    expect(plan[0].payload.title).toBe("Rahul is free now");
  });

  it("does nothing in a squad of one", () => {
    const newSlot = slot("s1", "r", "2026-09-27T14:00:00Z", "2026-09-27T16:00:00Z");
    expect(
      planSlotNotifications({ ...base, members: [rahul], newSlot, activeSlots: [newSlot] }),
    ).toEqual([]);
  });
});
