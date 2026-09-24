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
const getUserMock = vi.fn();
const signInAnonymouslyMock = vi.fn();
const supabaseMock = {
  from: fromMock,
  auth: { getUser: getUserMock, signInAnonymously: signInAnonymouslyMock },
};

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

const initialState = { error: null };

beforeEach(() => {
  insertMock.mockReset();
  fromMock.mockClear();
  redirectMock.mockClear();
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
  signInAnonymouslyMock.mockReset();
});

describe("createSquad", () => {
  it("redirects using the locally generated invite code, not a DB round-trip", async () => {
    insertMock.mockResolvedValue({ data: null, error: null });

    await expect(createSquad(initialState, formData({ name: "Brawl Stars crew" }))).rejects.toThrow(
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

  it("returns the error as form state when the insert fails, without redirecting", async () => {
    insertMock.mockResolvedValue({
      data: null,
      error: { message: "duplicate key value violates unique constraint" },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const state = await createSquad(initialState, formData({ name: "Brawl Stars crew" }));
    expect(state.error).toMatch(/duplicate key/);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("rejects an empty squad name before touching the database", async () => {
    const state = await createSquad(initialState, formData({ name: "  " }));
    expect(state.error).toMatch(/Give your squad a name/);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("signs a brand-new device in anonymously before inserting", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    signInAnonymouslyMock.mockResolvedValue({ data: { user: { id: "anon" } }, error: null });
    insertMock.mockResolvedValue({ data: null, error: null });

    await expect(
      createSquad(initialState, formData({ name: "Brawl Stars crew" })),
    ).rejects.toThrow(/^REDIRECT:/);

    expect(signInAnonymouslyMock).toHaveBeenCalledTimes(1);
    expect(signInAnonymouslyMock.mock.invocationCallOrder[0]).toBeLessThan(
      insertMock.mock.invocationCallOrder[0],
    );
  });

  // Regression for the production bug: with anonymous sign-ins disabled
  // the insert ran with no session, RLS rejected it, and the thrown error
  // reached users only as "Minified React error #441".
  it("explains the Supabase setting when anonymous sign-ins are disabled", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    signInAnonymouslyMock.mockResolvedValue({
      data: { user: null },
      error: { code: "anonymous_provider_disabled", message: "Anonymous sign-ins are disabled" },
    });

    const state = await createSquad(initialState, formData({ name: "Brawl Stars crew" }));

    expect(state.error).toMatch(/Anonymous sign-ins are turned off/);
    expect(insertMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
