"use client";

import { useEffect, useState } from "react";
import { joinSquad } from "@/lib/actions";
import { detectTimezone, isValidTimezone } from "@/lib/time";
import { Button, Input } from "@/components/ui";

export function JoinForm({
  squadId,
  inviteCode,
}: {
  squadId: string;
  inviteCode: string;
}) {
  const [timezone, setTimezone] = useState("UTC");

  useEffect(() => {
    // One-time bootstrap from the browser's Intl API, which isn't
    // available (in the visitor-relevant sense) during SSR — the server
    // would report its own timezone, not the visitor's.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimezone(detectTimezone());
  }, []);

  return (
    <form action={joinSquad} className="flex flex-col gap-4">
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
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
        />
        {!isValidTimezone(timezone) && (
          <p className="mt-2 text-sm text-sunset">
            That doesn&rsquo;t look like a valid time zone (e.g.
            &ldquo;Asia/Kolkata&rdquo;).
          </p>
        )}
      </div>

      <Button type="submit" variant="primary">
        Join squad
      </Button>
    </form>
  );
}
