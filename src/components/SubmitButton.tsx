"use client";

import { type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

/**
 * A submit button that disables itself and swaps its label while the
 * enclosing <form>'s Server Action is in flight, so a slow network
 * can't turn one tap into two squads / two identical slots.
 */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} aria-disabled={pending} {...props}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

/** Inline error line under a form, announced to screen readers. */
export function FormError({ message }: { message: string | null | undefined }) {
  return (
    <p aria-live="polite" className="text-sm text-sunset empty:hidden">
      {message ?? ""}
    </p>
  );
}
