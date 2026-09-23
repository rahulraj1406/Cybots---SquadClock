"use client";

import { useState } from "react";
import { createSlot } from "@/lib/actions";
import { Button, Input } from "@/components/ui";

function QuickFreeButton({
  squadId,
  memberId,
  inviteCode,
  hours,
}: {
  squadId: string;
  memberId: string;
  inviteCode: string;
  hours: number;
}) {
  return (
    <form action={createSlot}>
      <input type="hidden" name="mode" value="relative" />
      <input type="hidden" name="squadId" value={squadId} />
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="inviteCode" value={inviteCode} />
      <input type="hidden" name="startInHours" value="0" />
      <input type="hidden" name="durationHours" value={hours} />
      <Button type="submit" size="sm">
        Free now for {hours}h
      </Button>
    </form>
  );
}

export function AddSlotForm({
  squadId,
  memberId,
  inviteCode,
  timezone,
}: {
  squadId: string;
  memberId: string;
  inviteCode: string;
  timezone: string;
}) {
  const [mode, setMode] = useState<"relative" | "absolute">("relative");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <QuickFreeButton
          squadId={squadId}
          memberId={memberId}
          inviteCode={inviteCode}
          hours={1}
        />
        <QuickFreeButton
          squadId={squadId}
          memberId={memberId}
          inviteCode={inviteCode}
          hours={2}
        />
        <QuickFreeButton
          squadId={squadId}
          memberId={memberId}
          inviteCode={inviteCode}
          hours={4}
        />
      </div>

      <div className="flex gap-4 font-mono text-xs uppercase tracking-[1.2px] text-mute">
        <button
          type="button"
          onClick={() => setMode("relative")}
          className={mode === "relative" ? "text-ink" : undefined}
        >
          In __h for __h
        </button>
        <button
          type="button"
          onClick={() => setMode("absolute")}
          className={mode === "absolute" ? "text-ink" : undefined}
        >
          Pick date &amp; time
        </button>
      </div>

      {mode === "relative" ? (
        <form action={createSlot} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="mode" value="relative" />
          <input type="hidden" name="squadId" value={squadId} />
          <input type="hidden" name="memberId" value={memberId} />
          <input type="hidden" name="inviteCode" value={inviteCode} />

          <label className="flex flex-col gap-1 text-sm text-body">
            Free in (hours)
            <Input
              type="number"
              name="startInHours"
              min={0}
              max={336}
              step={0.5}
              defaultValue={0}
              className="w-28"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-body">
            For (hours)
            <Input
              type="number"
              name="durationHours"
              min={0.25}
              max={24}
              step={0.5}
              defaultValue={2}
              className="w-28"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-body">
            Note (optional)
            <Input name="note" maxLength={140} className="w-40" />
          </label>
          <Button type="submit" variant="primary">
            Add slot
          </Button>
        </form>
      ) : (
        <form action={createSlot} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="mode" value="absolute" />
          <input type="hidden" name="squadId" value={squadId} />
          <input type="hidden" name="memberId" value={memberId} />
          <input type="hidden" name="inviteCode" value={inviteCode} />
          <input type="hidden" name="timezone" value={timezone} />

          <label className="flex flex-col gap-1 text-sm text-body">
            Date
            <Input type="date" name="dateISO" required />
          </label>
          <label className="flex flex-col gap-1 text-sm text-body">
            Time
            <Input type="time" name="timeHHmm" required defaultValue="08:00" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-body">
            For (hours)
            <Input
              type="number"
              name="durationHours"
              min={0.25}
              max={24}
              step={0.5}
              defaultValue={2}
              className="w-28"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-body">
            Note (optional)
            <Input name="note" maxLength={140} className="w-40" />
          </label>
          <Button type="submit" variant="primary">
            Add slot
          </Button>
        </form>
      )}
    </div>
  );
}
