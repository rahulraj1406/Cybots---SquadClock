"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input } from "@/components/ui";

/**
 * Accepts a raw invite code ("abc123"), a full invite link, or a link
 * without the scheme ("squadclock.vercel.app/s/abc123"). Codes are
 * generated lowercase, so the result is lowercased too, since phones
 * love to auto-capitalise the first letter of a pasted or typed code.
 */
export function extractCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const fromPath = trimmed.match(/\/s\/([A-Za-z0-9]+)/);
  if (fromPath) return fromPath[1].toLowerCase();

  const bare = trimmed.replace(/^\/+|\/+$/g, "");
  return /^[A-Za-z0-9]+$/.test(bare) ? bare.toLowerCase() : null;
}

export function JoinByCodeForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = extractCode(value);
    if (!code) {
      setError("That doesn't look like an invite link or code");
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
