import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const { extractCode } = await import("../JoinByCodeForm");

describe("extractCode", () => {
  it.each([
    ["abcd2345", "abcd2345"],
    ["  Abcd2345 ", "abcd2345"],
    ["https://squadclock.vercel.app/s/abcd2345", "abcd2345"],
    ["https://squadclock.vercel.app/s/abcd2345/join", "abcd2345"],
    ["squadclock.vercel.app/s/ABCD2345", "abcd2345"],
    ["/s/abcd2345/", "abcd2345"],
  ])("reads %j as %j", (input, code) => {
    expect(extractCode(input)).toBe(code);
  });

  it.each(["", "   ", "not a code!", "https://example.com/"])("rejects %j", (input) => {
    expect(extractCode(input)).toBeNull();
  });
});
