/**
 * Push notifications are optional: they switch on only when all four
 * env vars are set (see README, "Push notifications"). Without them the
 * app works exactly as before and the board doesn't offer the toggle.
 */
export type PushConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
  serviceRoleKey: string;
};

export function getPushConfig(): PushConfig | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!publicKey || !privateKey || !subject || !serviceRoleKey) return null;
  return { publicKey, privateKey, subject, serviceRoleKey };
}

/**
 * Hosts of the browser vendors' push services. A subscription endpoint
 * is a URL our server will POST to, so accepting any URL would let a
 * squad member point the server at arbitrary hosts (SSRF). Chrome/Edge,
 * Firefox, Safari (macOS + iOS) and legacy Windows endpoints are covered.
 */
const PUSH_SERVICE_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && PUSH_SERVICE_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}
