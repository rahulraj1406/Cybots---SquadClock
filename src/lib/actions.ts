"use server";

import { customAlphabet } from "nanoid";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { absoluteSlotToUtc, relativeSlotToUtc } from "@/lib/time";

// Unambiguous alphabet (no 0/O/1/I/l) since invite codes get read aloud
// and typed by hand as often as they get pasted from a link.
const inviteCode = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 8);

const createSquadSchema = z.object({
  name: z.string().trim().min(1, "Give your squad a name").max(60),
});

export async function createSquad(formData: FormData) {
  const parsed = createSquadSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }

  const supabase = await createClient();
  const code = inviteCode();

  // Deliberately not chaining .select().single() here: the "squads"
  // SELECT RLS policy only allows members to read a squad, and the
  // creator isn't a member yet (that happens in the /join step right
  // after this redirect). Selecting the row back would hit the RLS gap
  // and come back empty, which supabase-js turns into a thrown error —
  // we already have the invite code locally, so there's nothing to read.
  const { error } = await supabase
    .from("squads")
    .insert({ name: parsed.data.name, invite_code: code });

  if (error) throw new Error(error.message);

  redirect(`/s/${code}/join`);
}

const joinSquadSchema = z.object({
  squadId: z.string().uuid(),
  inviteCode: z.string().min(1),
  displayName: z.string().trim().min(1, "Enter your name").max(40),
  timezone: z.string().min(1, "Pick a timezone"),
});

export async function joinSquad(formData: FormData) {
  const parsed = joinSquadSchema.safeParse({
    squadId: formData.get("squadId"),
    inviteCode: formData.get("inviteCode"),
    displayName: formData.get("displayName"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase.from("members").upsert(
    {
      squad_id: parsed.data.squadId,
      user_id: user.id,
      display_name: parsed.data.displayName,
      timezone: parsed.data.timezone,
    },
    { onConflict: "squad_id,user_id" },
  );

  if (error) throw new Error(error.message);

  redirect(`/s/${parsed.data.inviteCode}`);
}

const relativeSlotSchema = z.object({
  mode: z.literal("relative"),
  squadId: z.string().uuid(),
  memberId: z.string().uuid(),
  inviteCode: z.string().min(1),
  startInHours: z.coerce.number().min(0).max(24 * 14),
  durationHours: z.coerce.number().min(0.25).max(24),
  note: z.string().trim().max(140).optional(),
});

const absoluteSlotSchema = z.object({
  mode: z.literal("absolute"),
  squadId: z.string().uuid(),
  memberId: z.string().uuid(),
  inviteCode: z.string().min(1),
  dateISO: z.string().min(1),
  timeHHmm: z.string().regex(/^\d{2}:\d{2}$/),
  durationHours: z.coerce.number().min(0.25).max(24),
  timezone: z.string().min(1),
  note: z.string().trim().max(140).optional(),
});

const createSlotSchema = z.discriminatedUnion("mode", [
  relativeSlotSchema,
  absoluteSlotSchema,
]);

export async function createSlot(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = createSlotSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }

  const bounds =
    parsed.data.mode === "relative"
      ? relativeSlotToUtc(parsed.data)
      : absoluteSlotToUtc(parsed.data);

  const supabase = await createClient();
  const { error } = await supabase.from("slots").insert({
    squad_id: parsed.data.squadId,
    member_id: parsed.data.memberId,
    starts_at: bounds.starts_at,
    ends_at: bounds.ends_at,
    note: parsed.data.note || null,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/s/${parsed.data.inviteCode}`);
}

const deleteSlotSchema = z.object({
  slotId: z.string().uuid(),
  inviteCode: z.string().min(1),
});

export async function deleteSlot(formData: FormData) {
  const parsed = deleteSlotSchema.safeParse({
    slotId: formData.get("slotId"),
    inviteCode: formData.get("inviteCode"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const { error } = await supabase.from("slots").delete().eq("id", parsed.data.slotId);
  if (error) throw new Error(error.message);

  revalidatePath(`/s/${parsed.data.inviteCode}`);
}
