"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input } from "@/components/ui";

/** Accepts either a raw invite code ("abc123") or a full invite link. */
function extractCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/s\/([^/]+)/);
    if (match) return match[1];
  } catch {
    // Not a URL — treat the raw input as the code.
  }

  return trimmed.replace(/^\/+|\/+$/g, "");
}

export function JoinByCodeForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = extractCode(value);
    if (!code) {
      setError("Paste an invite link or code");
      return;
    }
    router.push(`/s/${code}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        placeholder="Paste an invite link or code"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
      />
      {error && <p className="text-sm text-sunset">{error}</p>}
      <Button type="submit" className="self-start">
        Join squad
      </Button>
    </form>
  );
}
