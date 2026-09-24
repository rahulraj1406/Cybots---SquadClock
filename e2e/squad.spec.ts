import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * The whole product loop from docs/PROJECT.md, with devices in three
 * different time zones: create a squad, join it from an invite link,
 * post availability, and watch it (and the overlap) appear live on the
 * other device, including after the owner removes it.
 */

async function device(browser: Browser, timezoneId: string): Promise<Page> {
  const context = await browser.newContext({ timezoneId });
  return context.newPage();
}

async function joinAs(page: Page, name: string, expectedZone: string) {
  await page.waitForURL(/\/join$/);
  // The zone is filled in from the browser after hydration.
  await expect(page.locator("#timezone")).toHaveValue(expectedZone);
  await page.fill("#displayName", name);
  await page.getByRole("button", { name: "Join squad" }).click();
  await page.waitForURL(/\/s\/[a-z0-9]+$/);
  await expect(page.getByText(`${name} (you)`)).toBeVisible();
}

test("two friends in different time zones coordinate in real time", async ({ browser }) => {
  const rahul = await device(browser, "Europe/Dublin");
  const arjun = await device(browser, "Asia/Kolkata");

  // Rahul creates a squad and joins it.
  await rahul.goto("/");
  await rahul.fill("#name", "E2E crew");
  await rahul.getByRole("button", { name: "Create a squad" }).click();
  await joinAs(rahul, "Rahul", "Europe/Dublin");
  const inviteCode = new URL(rahul.url()).pathname.split("/")[2];

  // Arjun opens the invite link on a fresh device.
  await arjun.goto(`/s/${inviteCode}`);
  await expect(arjun.getByRole("heading", { name: "E2E crew" })).toBeVisible();
  await joinAs(arjun, "Arjun", "Asia/Kolkata");

  // Rahul's board shows Arjun joining without a reload (realtime).
  await expect(rahul.getByText("Arjun", { exact: true })).toBeVisible();
  await expect(rahul.getByText("Kolkata · GMT+5:30")).toBeVisible();

  // Rahul is free now for 2h; Arjun sees it live, in both zones.
  await rahul.getByRole("button", { name: "Free now for 2h" }).click();
  await expect(rahul.getByText(/free now · 1h 59m left|free now · 2h 0m left/)).toBeVisible();
  await expect(arjun.getByText(/their time/)).toBeVisible();

  // Arjun is free for 1h too, so both boards show the full-squad overlap.
  await arjun.getByRole("button", { name: "Free now for 1h" }).click();
  await expect(rahul.getByText("Everyone free")).toBeVisible();
  await expect(arjun.getByText("Everyone free")).toBeVisible();

  // Rahul removes his slot: it disappears from Arjun's board live, and
  // with it the overlap.
  await rahul.getByRole("button", { name: "Remove" }).click();
  await expect(arjun.getByText(/their time/)).toHaveCount(0);
  await expect(arjun.getByText("Everyone free")).toHaveCount(0);
});

test("a slot in the past is refused inline, not with a crash", async ({ browser }) => {
  const page = await device(browser, "America/Toronto");
  await page.goto("/");
  await page.fill("#name", "Past crew");
  await page.getByRole("button", { name: "Create a squad" }).click();
  await joinAs(page, "Maya", "America/Toronto");

  await page.getByRole("tab", { name: "Pick date & time" }).click();
  // Skip the picker's own min= so the server-side check is what's tested.
  await page.locator("input[name=dateISO]").evaluate((el) => el.removeAttribute("min"));
  await page.fill("input[name=dateISO]", "2020-01-01");
  await page.getByRole("button", { name: "Add slot" }).click();

  await expect(page.getByText(/That time has already passed/)).toBeVisible();
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
});

test("strangers can't see a board, and unknown codes 404", async ({ browser }) => {
  const owner = await device(browser, "Europe/Dublin");
  await owner.goto("/");
  await owner.fill("#name", "Private crew");
  await owner.getByRole("button", { name: "Create a squad" }).click();
  await joinAs(owner, "Owner", "Europe/Dublin");
  const inviteCode = new URL(owner.url()).pathname.split("/")[2];

  const stranger = await device(browser, "UTC");
  await stranger.goto(`/s/${inviteCode}`);
  await expect(stranger).toHaveURL(new RegExp(`/s/${inviteCode}/join$`));

  // Capitalised codes (phone keyboards) still resolve.
  await stranger.goto(`/s/${inviteCode.toUpperCase()}`);
  await expect(stranger).toHaveURL(new RegExp(`/s/${inviteCode}/join$`));

  const response = await stranger.goto("/s/nosuchsquad");
  expect(response?.status()).toBe(404);
});

test("the home page lists squads this device has joined", async ({ browser }) => {
  const page = await device(browser, "Europe/Dublin");
  await page.goto("/");
  await expect(page.getByText("Your squads")).toHaveCount(0);

  await page.fill("#name", "Home crew");
  await page.getByRole("button", { name: "Create a squad" }).click();
  await joinAs(page, "Rahul", "Europe/Dublin");

  await page.goto("/");
  await expect(page.getByText("Your squads")).toBeVisible();
  await page.getByRole("link", { name: /Home crew/ }).click();
  await expect(page.getByRole("heading", { name: "Home crew" })).toBeVisible();
});
