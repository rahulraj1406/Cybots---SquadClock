"use client";

import { useEffect, useState } from "react";
import { deletePushSubscription, savePushSubscription } from "@/lib/actions";

type Status =
  | "loading"
  | "unsupported" // no service worker / Push API in this browser
  | "needs-install" // iPhone/iPad: push only works from the home screen app
  | "blocked" // the user denied permission in the browser
  | "off"
  | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIosOutsideHomeScreen(): boolean {
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

/**
 * Rejects if `promise` hasn't settled after `ms`. pushManager.subscribe()
 * can hang indefinitely when the browser can't reach its push service
 * (some Chromium builds, locked-down networks), which would otherwise
 * leave the button spinning forever.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/**
 * "Notify me" switch for this device on this squad (Phase 2 in
 * docs/PROJECT.md). Rendered only when the server has push configured.
 */
export function NotificationsToggle({
  memberId,
  vapidPublicKey,
}: {
  memberId: string;
  vapidPublicKey: string;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // Browser capabilities are only knowable after mount.
      if (isIosOutsideHomeScreen()) return setStatus("needs-install");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setStatus("unsupported");
      }
      if (Notification.permission === "denied") return setStatus("blocked");
      setStatus((await currentSubscription()) ? "on" : "off");
    })().catch(() => setStatus("unsupported"));
  }, []);

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await withTimeout(
          registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          }),
          20_000,
        ));

      const json = subscription.toJSON();
      const result = await savePushSubscription({
        memberId,
        endpoint: subscription.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setStatus("on");
    } catch (e) {
      console.error("enable notifications failed", e);
      setError(
        "Couldn't turn on notifications in this browser. " +
          "Private/incognito windows don't support them.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError(null);
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        const result = await deletePushSubscription({ memberId, endpoint: subscription.endpoint });
        if (result.error) {
          setError(result.error);
          return;
        }
        // The same browser subscription may serve other squads, which
        // each hold their own row, so only this squad's row is removed.
      }
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading" || status === "unsupported") return null;

  const hint =
    status === "needs-install"
      ? "To get alerts on iPhone, tap Share → Add to Home Screen, then open SquadClock from there."
      : status === "blocked"
        ? "Notifications are blocked for this site in your browser settings."
        : status === "on"
          ? "You'll get a ping when someone's free now, or the whole squad overlaps."
          : "Get a ping when someone's free now, or the whole squad overlaps.";

  return (
    <div className="flex flex-col gap-2 rounded-card border border-hairline bg-canvas-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-body">{hint}</p>
      {(status === "off" || status === "on") && (
        <button
          type="button"
          role="switch"
          aria-checked={status === "on"}
          disabled={busy}
          onClick={status === "on" ? turnOff : turnOn}
          className="shrink-0 self-start rounded-pill border border-hairline-strong px-3 py-1.5 text-[13px] text-ink hover:bg-canvas-soft disabled:opacity-40 sm:self-auto"
        >
          {busy ? "…" : status === "on" ? "Notifications on" : "Turn on notifications"}
        </button>
      )}
      {error && (
        <p aria-live="polite" className="text-sm text-sunset">
          {error}
        </p>
      )}
    </div>
  );
}
