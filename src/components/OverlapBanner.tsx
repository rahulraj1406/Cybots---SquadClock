"use client";

import { formatSlotRange, formatSlotStatus } from "@/lib/time";
import { buildOverlapMessage } from "@/lib/whatsapp";
import type { Member, OverlapWindow } from "@/lib/types";
import { Card, Eyebrow } from "@/components/ui";
import { ShareButton } from "@/components/ShareButton";

function OverlapRow({
  window,
  members,
  totalMemberCount,
  viewerTimezone,
  inviteUrl,
  full,
}: {
  window: OverlapWindow;
  members: Member[];
  totalMemberCount: number;
  viewerTimezone: string;
  inviteUrl: string;
  full: boolean;
}) {
  const involved = members.filter((m) => window.memberIds.includes(m.id));
  const names = involved.map((m) => m.display_name).join(", ");

  const status = formatSlotStatus(window.starts_at, window.ends_at);

  const message = buildOverlapMessage({
    starts_at: window.starts_at,
    ends_at: window.ends_at,
    members: involved,
    totalMemberCount,
    inviteUrl,
  });

  return (
    <div
      className={
        full
          ? "rounded-card border border-live/40 bg-live-soft/30 p-4"
          : "rounded-card border border-hairline bg-canvas-soft p-4"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <span
              className={
                full
                  ? "h-2 w-2 rounded-full bg-live"
                  : "h-2 w-2 rounded-full bg-mute"
              }
            />
            {full ? "Everyone" : names} free
          </p>
          <p className="mt-1 text-sm text-body">
            {formatSlotRange(window.starts_at, window.ends_at, viewerTimezone)}
          </p>
          <p
            suppressHydrationWarning
            className={`mt-1 font-mono text-xs uppercase tracking-[1.2px] ${
              status.live ? "text-live" : "text-mute"
            }`}
          >
            {status.label} · your time
          </p>
        </div>
        <ShareButton message={message} label="Share" />
      </div>
    </div>
  );
}

export function OverlapBanner({
  fullWindows,
  partialWindows,
  members,
  totalMemberCount,
  viewerTimezone,
  inviteUrl,
}: {
  fullWindows: OverlapWindow[];
  partialWindows: OverlapWindow[];
  members: Member[];
  totalMemberCount: number;
  viewerTimezone: string;
  inviteUrl: string;
}) {
  if (fullWindows.length === 0 && partialWindows.length === 0) return null;

  return (
    <Card>
      <Eyebrow>Overlaps</Eyebrow>
      <div className="mt-4 flex flex-col gap-3">
        {fullWindows.map((w) => (
          <OverlapRow
            key={`${w.starts_at}-${w.ends_at}-full`}
            window={w}
            members={members}
            totalMemberCount={totalMemberCount}
            viewerTimezone={viewerTimezone}
            inviteUrl={inviteUrl}
            full
          />
        ))}
        {partialWindows.map((w) => (
          <OverlapRow
            key={`${w.starts_at}-${w.ends_at}-${w.memberIds.join(",")}`}
            window={w}
            members={members}
            totalMemberCount={totalMemberCount}
            viewerTimezone={viewerTimezone}
            inviteUrl={inviteUrl}
            full={false}
          />
        ))}
      </div>
    </Card>
  );
}
