/**
 * Copies text, returning whether it worked. navigator.clipboard is
 * missing outside secure contexts and in some in-app browsers (e.g. the
 * one WhatsApp opens links in), and it can reject when the page isn't
 * focused, so fall back to the legacy execCommand path before giving up.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Opens the OS share sheet where there is one (phones, mostly). Returns
 * "shared", "cancelled" (the user closed the sheet), or "unsupported" so
 * the caller can fall back to copying.
 */
export async function shareNative(data: ShareData): Promise<"shared" | "cancelled" | "unsupported"> {
  if (typeof navigator === "undefined" || !navigator.share) return "unsupported";
  if (navigator.canShare && !navigator.canShare(data)) return "unsupported";
  try {
    await navigator.share(data);
    return "shared";
  } catch (e) {
    return e instanceof DOMException && e.name === "AbortError" ? "cancelled" : "unsupported";
  }
}
