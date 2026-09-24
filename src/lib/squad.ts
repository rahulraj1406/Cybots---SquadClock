import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Member, Squad, SlotWithMember } from "@/lib/types";

/**
 * Wrapped in React's cache() so generateMetadata and the page itself
 * share one lookup per request. It's an RPC (a POST), which Next.js's
 * fetch memoization doesn't cover.
 */
export const getSquadByInviteCode = cache(async function getSquadByInviteCode(
  code: string,
): Promise<Pick<Squad, "id" | "name"> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_squad_by_invite_code", { code })
    .maybeSingle();

  if (error) console.error("getSquadByInviteCode failed", error);
  if (error || !data) return null;
  return data as Pick<Squad, "id" | "name">;
});

export async function getCurrentMember(squadId: string): Promise<Member | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("members")
    .select("*")
    .eq("squad_id", squadId)
    .eq("user_id", user.id)
    .maybeSingle();

  return (data as Member) ?? null;
}

export async function getSquadBoardData(squadId: string): Promise<{
  members: Member[];
  slots: SlotWithMember[];
}> {
  const supabase = await createClient();

  const [{ data: members }, { data: slots }] = await Promise.all([
    supabase.from("members").select("*").eq("squad_id", squadId).order("created_at"),
    supabase
      .from("slots")
      .select("*, member:members(id, display_name, timezone)")
      .eq("squad_id", squadId)
      .gt("ends_at", new Date().toISOString())
      .order("starts_at"),
  ]);

  return {
    members: (members as Member[]) ?? [],
    slots: (slots as unknown as SlotWithMember[]) ?? [],
  };
}
