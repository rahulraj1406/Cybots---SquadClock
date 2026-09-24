"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, Eyebrow } from "@/components/ui";

type MySquad = { code: string; name: string; displayName: string };

/**
 * The squads this device has joined, so the home page (and the installed
 * app, which opens at "/") leads straight back to them without needing
 * the invite link again. Loaded in the browser so "/" stays a static
 * page; renders nothing for a device that hasn't joined anything.
 */
export function YourSquads() {
  const [squads, setSquads] = useState<MySquad[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("members")
        .select("display_name, created_at, squad:squads(name, invite_code)")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (cancelled || error || !data) return;

      setSquads(
        data.flatMap((row) => {
          // A to-one embed; typed loosely by supabase-js without generated types.
          const squad = row.squad as unknown as { name: string; invite_code: string } | null;
          return squad
            ? [{ code: squad.invite_code, name: squad.name, displayName: row.display_name }]
            : [];
        }),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!squads || squads.length === 0) return null;

  return (
    <Card className="mt-10">
      <Eyebrow>Your squads</Eyebrow>
      <ul className="mt-4 flex flex-col">
        {squads.map((s) => (
          <li key={s.code} className="border-b border-hairline last:border-0">
            <Link
              href={`/s/${s.code}`}
              className="flex items-center justify-between gap-3 py-3 text-ink hover:text-body"
            >
              <span className="min-w-0 truncate">{s.name}</span>
              <span className="shrink-0 text-xs text-mute">as {s.displayName} →</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
