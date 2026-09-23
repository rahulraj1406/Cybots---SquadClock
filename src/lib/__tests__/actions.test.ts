import { beforeEach, describe, expect, it, vi } from "vitest";

// createSquad must redirect using the invite code it generated locally,
// never one read back from the database. Reading it back would go
// through the "squads" SELECT RLS policy, which only allows members to
// read a squad — and the creator isn't a member yet at this point (that
// happens in the /join step right after redirect). Regression test for
// the bug where .insert().select().single() came back empty under RLS
// and surfaced to users as a generic React error #441.

const insertMock = vi.fn();
const fromMock = vi.fn(() => ({ insert: insertMock }));
const supabaseMock = { from: fromMock };

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(supabaseMock)),
}));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createSquad } = await import("../actions");

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  insertMock.mockReset();
  fromMock.mockClear();
  redirectMock.mockClear();
});

describe("createSquad", () => {
  it("redirects using the locally generated invite code, not a DB round-trip", async () => {
    insertMock.mockResolvedValue({ data: null, error: null });

    await expect(createSquad(formData({ name: "Brawl Stars crew" }))).rejects.toThrow(
      /^REDIRECT:/,
    );

    expect(fromMock).toHaveBeenCalledWith("squads");
    const insertedRow = insertMock.mock.calls[0][0];
    expect(insertedRow.name).toBe("Brawl Stars crew");
    expect(typeof insertedRow.invite_code).toBe("string");

    const redirectUrl = redirectMock.mock.calls[0][0] as string;
    expect(redirectUrl).toBe(`/s/${insertedRow.invite_code}/join`);

    // The key regression check: insert() must not be chained with
    // .select()/.single() — mockResolvedValue on insertMock is only
    // valid because nothing is called on its return value.
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("throws when the insert fails, without redirecting", async () => {
    insertMock.mockResolvedValue({
      data: null,
      error: { message: "duplicate key value violates unique constraint" },
    });

    await expect(createSquad(formData({ name: "Brawl Stars crew" }))).rejects.toThrow(
      /duplicate key/,
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("rejects an empty squad name before touching the database", async () => {
    await expect(createSquad(formData({ name: "  " }))).rejects.toThrow(
      /Give your squad a name/,
    );
    expect(fromMock).not.toHaveBeenCalled();
  });
});
