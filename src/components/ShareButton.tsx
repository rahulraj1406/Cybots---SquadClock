"use client";

import { useState } from "react";
import { copyText } from "@/lib/clipboard";
import { whatsappShareUrl } from "@/lib/whatsapp";
import { Button } from "@/components/ui";

export function ShareButton({
  message,
  label = "Share to WhatsApp",
}: {
  message: string;
  label?: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        aria-label={`${label} on WhatsApp`}
        onClick={() => window.open(whatsappShareUrl(message), "_blank", "noopener")}
      >
        {label}
      </Button>
      <button
        type="button"
        title="Copy message"
        className="font-mono text-xs uppercase tracking-[1.2px] text-mute hover:text-body"
        onClick={async () => {
          setCopyState((await copyText(message)) ? "copied" : "failed");
          setTimeout(() => setCopyState("idle"), 1500);
        }}
      >
        {copyState === "copied" ? "Copied" : copyState === "failed" ? "Can't copy" : "Copy"}
      </button>
    </div>
  );
}
