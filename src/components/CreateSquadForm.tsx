"use client";

import { useActionState } from "react";
import { createSquad } from "@/lib/actions";
import type { ActionState } from "@/lib/types";
import { Input } from "@/components/ui";
import { FormError, SubmitButton } from "@/components/SubmitButton";

const initialState: ActionState = { error: null };

export function CreateSquadForm() {
  const [state, formAction] = useActionState(createSquad, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="name" className="mb-2 block text-sm text-body">
          Squad name
        </label>
        <Input
          id="name"
          name="name"
          placeholder="Brawl Stars crew"
          required
          maxLength={60}
        />
      </div>
      <FormError message={state.error} />
      <SubmitButton variant="primary" pendingLabel="Creating…">
        Create a squad
      </SubmitButton>
    </form>
  );
}
