"use client";

import { useState } from "react";
import { whatsappShareUrl } from "@/lib/whatsapp";
import { Button } from "@/components/ui";

export function ShareButton({
  message,
  label = "Share to WhatsApp",
}: {
  message: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        onClick={() => window.open(whatsappShareUrl(message), "_blank", "noopener")}
      >
        {label}
      </Button>
      <button
        type="button"
        title="Copy message"
        className="font-mono text-xs uppercase tracking-[1.2px] text-mute hover:text-body"
        onClick={async () => {
          await navigator.clipboard.writeText(message);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
