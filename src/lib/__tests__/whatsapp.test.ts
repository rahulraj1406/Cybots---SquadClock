import { describe, expect, it } from "vitest";
import { buildOverlapMessage, buildWhatsappMessage, whatsappShareUrl } from "../whatsapp";

const rahul = { id: "r", display_name: "Rahul", timezone: "Europe/Dublin" };
const arjun = { id: "a", display_name: "Arjun", timezone: "Asia/Kolkata" };
const maya = { id: "m", display_name: "Maya", timezone: "America/Toronto" };

// Sun 8:00–10:00 AM in Dublin (IST, UTC+1) on 2026-09-27.
const slot = { starts_at: "2026-09-27T07:00:00Z", ends_at: "2026-09-27T09:00:00Z" };

describe("buildWhatsappMessage", () => {
  const message = buildWhatsappMessage({
    ownerName: "Rahul",
    inviteUrl: "https://squadclock.vercel.app/s/abc123",
    note: "ranked",
    lines: [rahul, arjun, maya].map((member) => ({ member, ...slot })),
  });

  it("leads with the owner's slot in the owner's own time", () => {
    expect(message.split("\n")[0]).toBe("🎮 Rahul is free Sun, Sep 27 · 8:00–10:00 AM (Dublin time)");
  });

  it("gives every member the slot in their own local time", () => {
    expect(message).toContain("Arjun: Sun 12:30–2:30 PM (Kolkata)");
    expect(message).toContain("Maya: Sun 3:00–5:00 AM (Toronto)");
  });

  it("includes the note and the invite link", () => {
    expect(message).toContain("“ranked”");
    expect(message.endsWith("Join the squad: https://squadclock.vercel.app/s/abc123")).toBe(true);
  });
});

describe("buildOverlapMessage", () => {
  it("announces an all-squad overlap in each member's time", () => {
    const message = buildOverlapMessage({
      ...slot,
      members: [rahul, arjun, maya],
      totalMemberCount: 3,
      inviteUrl: "https://x.test/s/abc",
    });

    expect(message.split("\n")[0]).toBe("🎮 All 3 of us are free at the same time!");
    expect(message).toContain("Rahul: Sun 8:00–10:00 AM (Dublin)");
    expect(message).toContain("Arjun: Sun 12:30–2:30 PM (Kolkata)");
  });

  it("says how many of the squad a partial overlap covers", () => {
    const message = buildOverlapMessage({
      ...slot,
      members: [rahul, arjun],
      totalMemberCount: 3,
      inviteUrl: "https://x.test/s/abc",
    });
    expect(message.split("\n")[0]).toBe("🎮 2 of 3 are free at the same time");
  });
});

describe("whatsappShareUrl", () => {
  it("url-encodes the message into a wa.me link", () => {
    expect(whatsappShareUrl("a b\n🎮")).toBe("https://wa.me/?text=a%20b%0A%F0%9F%8E%AE");
  });
});
