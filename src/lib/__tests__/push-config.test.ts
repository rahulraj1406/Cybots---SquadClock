import { afterEach, describe, expect, it, vi } from "vitest";
import { getPushConfig, isAllowedPushEndpoint } from "../push/config";

describe("isAllowedPushEndpoint", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc:def",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAA",
    "https://web.push.apple.com/QGx5",
    "https://api.push.apple.com/3/device/abc",
    "https://db5p.notify.windows.com/w/?token=x",
  ])("accepts the browser push service %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc", // not https
    "https://evil.example.com/collect",
    "https://fcm.googleapis.com.evil.example.com/x",
    "https://169.254.169.254/latest/meta-data",
    "not a url",
  ])("refuses %s, which the server would otherwise POST to", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });
});

describe("getPushConfig", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off unless all four settings are present", () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
    vi.stubEnv("VAPID_SUBJECT", "mailto:me@example.com");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(getPushConfig()).toBeNull();

    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    expect(getPushConfig()).toEqual({
      publicKey: "pub",
      privateKey: "priv",
      subject: "mailto:me@example.com",
      serviceRoleKey: "service",
    });
  });
});
