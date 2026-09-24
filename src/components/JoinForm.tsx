"use client";

import { useActionState, useEffect, useState } from "react";
import { joinSquad } from "@/lib/actions";
import { detectTimezone, isValidTimezone } from "@/lib/time";
import type { ActionState } from "@/lib/types";
import { Input } from "@/components/ui";
import { FormError, SubmitButton } from "@/components/SubmitButton";

const initialState: ActionState = { error: null };

/** Every IANA zone the browser knows, for the time zone suggestions list. */
function supportedTimezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
  }
}

export function JoinForm({
  squadId,
  inviteCode,
}: {
  squadId: string;
  inviteCode: string;
}) {
  const [state, formAction] = useActionState(joinSquad, initialState);
  const [timezone, setTimezone] = useState("UTC");
  const [zones, setZones] = useState<string[]>([]);

  useEffect(() => {
    // One-time bootstrap from the browser's Intl API, which isn't
    // available (in the visitor-relevant sense) during SSR — the server
    // would report its own timezone, not the visitor's.
    /* eslint-disable react-hooks/set-state-in-effect */
    setTimezone(detectTimezone());
    setZones(supportedTimezones());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const timezoneValid = isValidTimezone(timezone.trim());

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="squadId" value={squadId} />
      <input type="hidden" name="inviteCode" value={inviteCode} />

      <div>
        <label htmlFor="displayName" className="mb-2 block text-sm text-body">
          Your name
        </label>
        <Input
          id="displayName"
          name="displayName"
          placeholder="Arjun"
          required
          maxLength={40}
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="timezone" className="mb-2 block text-sm text-body">
          Time zone
        </label>
        <Input
          id="timezone"
          name="timezone"
          list="timezone-options"
          autoComplete="off"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          aria-invalid={!timezoneValid}
        />
        <datalist id="timezone-options">
          {zones.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
        {timezoneValid ? (
          <p className="mt-2 text-xs text-mute">
            Detected from this device. Change it if it&rsquo;s wrong.
          </p>
        ) : (
          <p className="mt-2 text-sm text-sunset">
            That doesn&rsquo;t look like a valid time zone (e.g.
            &ldquo;Asia/Kolkata&rdquo;).
          </p>
        )}
      </div>

      <FormError message={state.error} />
      <SubmitButton variant="primary" pendingLabel="Joining…" disabled={!timezoneValid}>
        Join squad
      </SubmitButton>
    </form>
  );
}
