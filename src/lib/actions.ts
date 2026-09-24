"use server";

import { customAlphabet } from "nanoid";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/supabase/auth";
import { absoluteSlotToUtc, isValidTimezone, relativeSlotToUtc } from "@/lib/time";
import type { ActionState } from "@/lib/types";

/** Postgres SQLSTATE codes we branch on. */
const UNIQUE_VIOLATION = "23505";
const RLS_VIOLATION = "42501";

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

// Unambiguous alphabet (no 0/O/1/I/l) since invite codes get read aloud
// and typed by hand as often as they get pasted from a link.
const inviteCode = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 8);

const createSquadSchema = z.object({
  name: z.string().trim().min(1, "Give your squad a name").max(60),
});

export async function createSquad(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createSquadSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  // The "squads" INSERT policy requires auth.uid(), so the device needs
  // an identity before the insert — create one now if it's brand new.
  try {
    await getOrCreateUser(supabase);
  } catch (e) {
    return { error: errorMessage(e) };
  }

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

  if (error) {
    console.error("createSquad: insert failed", error);
    return { error: `Couldn't create the squad: ${error.message}` };
  }

  redirect(`/s/${code}/join`);
}

const joinSquadSchema = z.object({
  squadId: z.string().uuid(),
  inviteCode: z.string().min(1),
  displayName: z.string().trim().min(1, "Enter your name").max(40),
  // Validated against the IANA database, not just "non-empty": a bad zone
  // name would be stored and then break every time conversion for this
  // member on everyone else's board.
  timezone: z
    .string()
    .trim()
    .min(1, "Pick a time zone")
    .refine(isValidTimezone, "That isn't a valid time zone (e.g. “Asia/Kolkata”)"),
});

export async function joinSquad(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = joinSquadSchema.safeParse({
    squadId: formData.get("squadId"),
    inviteCode: formData.get("inviteCode"),
    displayName: formData.get("displayName"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  // A friend opening an invite link is usually a brand-new device.
  let user;
  try {
    user = await getOrCreateUser(supabase);
  } catch (e) {
    return { error: errorMessage(e) };
  }

  const profile = {
    display_name: parsed.data.displayName,
    timezone: parsed.data.timezone,
  };

  // Plain insert, not upsert. INSERT ... ON CONFLICT DO UPDATE makes
  // Postgres also check the new row against the members SELECT policy,
  // which only shows rows of squads you're already in, and you aren't
  // until this insert lands, so an upsert here always failed RLS
  // ("new row violates row-level security policy for table members").
  const { error: insertError } = await supabase
    .from("members")
    .insert({ squad_id: parsed.data.squadId, user_id: user.id, ...profile });

  let error = insertError;
  if (insertError?.code === UNIQUE_VIOLATION) {
    // Already a member of this squad on this device: treat re-joining
    // as "update my name / time zone".
    ({ error } = await supabase
      .from("members")
      .update(profile)
      .eq("squad_id", parsed.data.squadId)
      .eq("user_id", user.id));
  }

  if (error) {
    console.error("joinSquad: insert failed", error);
    return { error: `Couldn't join the squad: ${error.message}` };
  }

  redirect(`/s/${parsed.data.inviteCode}`);
}

const relativeSlotSchema = z.object({
  mode: z.literal("relative"),
  squadId: z.string().uuid(),
  memberId: z.string().uuid(),
  inviteCode: z.string().min(1),
  startInHours: z.coerce.number().min(0, "Start can't be in the past").max(24 * 14),
  durationHours: z.coerce
    .number()
    .min(0.25, "A slot needs to be at least 15 minutes")
    .max(24, "A slot can be at most 24 hours"),
  note: z.string().trim().max(140).optional(),
});

const absoluteSlotSchema = z.object({
  mode: z.literal("absolute"),
  squadId: z.string().uuid(),
  memberId: z.string().uuid(),
  inviteCode: z.string().min(1),
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  timeHHmm: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time"),
  durationHours: z.coerce
    .number()
    .min(0.25, "A slot needs to be at least 15 minutes")
    .max(24, "A slot can be at most 24 hours"),
  timezone: z.string().refine(isValidTimezone, "Invalid time zone"),
  note: z.string().trim().max(140).optional(),
});

const createSlotSchema = z.discriminatedUnion("mode", [
  relativeSlotSchema,
  absoluteSlotSchema,
]);

export async function createSlot(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = createSlotSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const bounds =
    parsed.data.mode === "relative"
      ? relativeSlotToUtc(parsed.data)
      : absoluteSlotToUtc(parsed.data);

  // e.g. "2026-02-30": Luxon yields an invalid DateTime whose toISO() is null.
  if (!bounds.starts_at || !bounds.ends_at) {
    return { error: "That date doesn't exist. Pick another one." };
  }

  // The board only shows slots that haven't ended, so a slot entirely in
  // the past would be saved and then silently never appear.
  if (Date.parse(bounds.ends_at) <= Date.now()) {
    return { error: "That time has already passed. Pick a later date or time." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("slots").insert({
    squad_id: parsed.data.squadId,
    member_id: parsed.data.memberId,
    starts_at: bounds.starts_at,
    ends_at: bounds.ends_at,
    note: parsed.data.note || null,
  });

  if (error) {
    console.error("createSlot: insert failed", error);
    if (error.code === RLS_VIOLATION) {
      return {
        error:
          "This device isn't signed in to the squad any more. Reload the page and rejoin.",
      };
    }
    return { error: `Couldn't save the slot: ${error.message}` };
  }

  revalidatePath(`/s/${parsed.data.inviteCode}`);
  return { error: null };
}

const deleteSlotSchema = z.object({
  slotId: z.string().uuid(),
  inviteCode: z.string().min(1),
});

export async function deleteSlot(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = deleteSlotSchema.safeParse({
    slotId: formData.get("slotId"),
    inviteCode: formData.get("inviteCode"),
  });
  if (!parsed.success) return { error: "Couldn't find that slot." };

  const supabase = await createClient();
  const { error } = await supabase.from("slots").delete().eq("id", parsed.data.slotId);
  if (error) {
    console.error("deleteSlot: delete failed", error);
    return { error: `Couldn't remove the slot: ${error.message}` };
  }

  revalidatePath(`/s/${parsed.data.inviteCode}`);
  return { error: null };
}
