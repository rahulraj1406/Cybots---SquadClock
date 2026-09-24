"use client";

import { useActionState, useState, type ReactNode } from "react";
import { DateTime } from "luxon";
import { createSlot } from "@/lib/actions";
import type { ActionState } from "@/lib/types";
import { Input } from "@/components/ui";
import { FormError, SubmitButton } from "@/components/SubmitButton";

const initialState: ActionState = { error: null };

type SlotTarget = { squadId: string; memberId: string; inviteCode: string };

/**
 * One <form> posting to createSlot, with the hidden squad/member fields
 * and its own error line. Each form gets its own useActionState so an
 * error shows next to the button that caused it.
 */
function SlotForm({
  target,
  mode,
  className,
  children,
}: {
  target: SlotTarget;
  mode: "relative" | "absolute";
  className?: string;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(createSlot, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="squadId" value={target.squadId} />
      <input type="hidden" name="memberId" value={target.memberId} />
      <input type="hidden" name="inviteCode" value={target.inviteCode} />
      <div className={className}>{children}</div>
      <FormError message={state.error} />
    </form>
  );
}

function QuickFreeButton({ target, hours }: { target: SlotTarget; hours: number }) {
  return (
    <SlotForm target={target} mode="relative">
      <input type="hidden" name="startInHours" value="0" />
      <input type="hidden" name="durationHours" value={hours} />
      <SubmitButton size="sm" pendingLabel="Posting…">
        Free now for {hours}h
      </SubmitButton>
    </SlotForm>
  );
}

function DurationField() {
  return (
    <label className="flex flex-col gap-1 text-sm text-body">
      For (hours)
      <Input
        type="number"
        name="durationHours"
        min={0.25}
        max={24}
        step={0.25}
        defaultValue={2}
        required
        className="w-28"
      />
    </label>
  );
}

function NoteField() {
  return (
    <label className="flex flex-col gap-1 text-sm text-body">
      Note (optional)
      <Input name="note" maxLength={140} placeholder="ranked?" className="w-40" />
    </label>
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
  const target = { squadId, memberId, inviteCode };
  // "Today" in the member's own zone, so the date picker's lower bound
  // matches the wall clock they're thinking in.
  const today = DateTime.now().setZone(timezone).toISODate() ?? undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {[1, 2, 4].map((hours) => (
          <QuickFreeButton key={hours} target={target} hours={hours} />
        ))}
      </div>

      <div role="tablist" className="flex gap-4 font-mono text-xs uppercase tracking-[1.2px] text-mute">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "relative"}
          onClick={() => setMode("relative")}
          className={mode === "relative" ? "text-ink" : "hover:text-body"}
        >
          In __h for __h
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "absolute"}
          onClick={() => setMode("absolute")}
          className={mode === "absolute" ? "text-ink" : "hover:text-body"}
        >
          Pick date &amp; time
        </button>
      </div>

      {mode === "relative" ? (
        <SlotForm target={target} mode="relative" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-body">
            Free in (hours)
            <Input
              type="number"
              name="startInHours"
              min={0}
              max={336}
              step={0.25}
              defaultValue={0}
              required
              className="w-28"
            />
          </label>
          <DurationField />
          <NoteField />
          <SubmitButton variant="primary" pendingLabel="Adding…">
            Add slot
          </SubmitButton>
        </SlotForm>
      ) : (
        <SlotForm target={target} mode="absolute" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="timezone" value={timezone} />
          <label className="flex flex-col gap-1 text-sm text-body">
            Date
            <Input
              type="date"
              name="dateISO"
              required
              min={today}
              defaultValue={today}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-body">
            Time
            <Input type="time" name="timeHHmm" required defaultValue="08:00" />
          </label>
          <DurationField />
          <NoteField />
          <SubmitButton variant="primary" pendingLabel="Adding…">
            Add slot
          </SubmitButton>
          <p className="basis-full text-xs text-mute">In your time ({timezone}).</p>
        </SlotForm>
      )}
    </div>
  );
}
