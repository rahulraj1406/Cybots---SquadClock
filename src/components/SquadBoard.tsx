"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { findOverlaps, fullOverlaps, partialOverlaps } from "@/lib/overlap";
import type { Member, Slot, SlotWithMember } from "@/lib/types";
import { OverlapBanner } from "@/components/OverlapBanner";
import { MemberSlots } from "@/components/MemberSlots";
import { AddSlotForm } from "@/components/AddSlotForm";
import { Eyebrow } from "@/components/ui";

export function SquadBoard({
  squadName,
  squadId,
  inviteCode,
  currentMemberId,
  viewerTimezone,
  initialMembers,
  initialSlots,
}: {
  squadName: string;
  squadId: string;
  inviteCode: string;
  currentMemberId: string;
  viewerTimezone: string;
  initialMembers: Member[];
  initialSlots: SlotWithMember[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [slots, setSlots] = useState(initialSlots);
  const [now, setNow] = useState(() => new Date());
  const [inviteCopied, setInviteCopied] = useState(false);

  const membersRef = useRef(members);
  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/s/${inviteCode}`
      : `/s/${inviteCode}`;

  // Keep countdowns fresh and drop slots as they expire, without waiting
  // for a realtime event (nothing else will tell us "time has passed").
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    async function subscribe() {
      // Realtime applies the table's RLS policies to each event using the
      // JWT the channel joined with. The browser client loads its session
      // from the auth cookie asynchronously, and without this await the
      // channel joined before that finished, i.e. as the anonymous role,
      // so RLS silently filtered out every slot/member event.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`squad-${squadId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "slots", filter: `squad_id=eq.${squadId}` },
          (payload) => {
            if (payload.eventType === "DELETE") {
              setSlots((prev) => prev.filter((s) => s.id !== (payload.old as Slot).id));
              return;
            }

            const raw = payload.new as Slot;
            const member = membersRef.current.find((m) => m.id === raw.member_id);
            if (!member) return; // member list will catch up on its own event

            const hydrated: SlotWithMember = {
              ...raw,
              member: {
                id: member.id,
                display_name: member.display_name,
                timezone: member.timezone,
              },
            };

            setSlots((prev) => [...prev.filter((s) => s.id !== hydrated.id), hydrated]);
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "members", filter: `squad_id=eq.${squadId}` },
          (payload) => {
            if (payload.eventType === "DELETE") {
              setMembers((prev) => prev.filter((m) => m.id !== (payload.old as Member).id));
              return;
            }
            const raw = payload.new as Member;
            setMembers((prev) => {
              const withoutThis = prev.filter((m) => m.id !== raw.id);
              return [...withoutThis, raw].sort(
                (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
              );
            });
          },
        )
        .subscribe();
    }

    void subscribe();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [squadId]);

  const activeSlots = useMemo(
    () => slots.filter((s) => new Date(s.ends_at) > now),
    [slots, now],
  );

  const windows = useMemo(() => findOverlaps(activeSlots), [activeSlots]);
  const full = useMemo(
    () => fullOverlaps(windows, members.length),
    [windows, members.length],
  );
  const partial = useMemo(
    () => partialOverlaps(windows, members.length),
    [windows, members.length],
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <Eyebrow>Squad</Eyebrow>
          <h1 className="mt-1 font-sans text-3xl tracking-[-0.02em] text-ink">
            {squadName}
          </h1>
        </div>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(inviteUrl);
            setInviteCopied(true);
            setTimeout(() => setInviteCopied(false), 1500);
          }}
          className="font-mono text-xs uppercase tracking-[1.2px] text-mute hover:text-body"
        >
          {inviteCopied ? "Link copied" : "Copy invite link"}
        </button>
      </header>

      <OverlapBanner
        fullWindows={full}
        partialWindows={partial}
        members={members}
        totalMemberCount={members.length}
        viewerTimezone={viewerTimezone}
        inviteUrl={inviteUrl}
      />

      <section>
        <Eyebrow>Add a slot</Eyebrow>
        <div className="mt-4">
          <AddSlotForm
            squadId={squadId}
            memberId={currentMemberId}
            inviteCode={inviteCode}
            timezone={viewerTimezone}
          />
        </div>
      </section>

      <section>
        <Eyebrow>Squad board</Eyebrow>
        <div className="mt-4">
          <MemberSlots
            members={members}
            slots={activeSlots}
            viewerTimezone={viewerTimezone}
            currentMemberId={currentMemberId}
            inviteCode={inviteCode}
            inviteUrl={inviteUrl}
          />
        </div>
      </section>
    </main>
  );
}
