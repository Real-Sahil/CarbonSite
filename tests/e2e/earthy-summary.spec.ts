import { test, expect } from "@playwright/test";
import { TERMS_VERSION } from "@/lib/legal/terms";

// The Earthy Tech Summary at desktop and phone width: no sideways scroll, no
// console errors, 44px touch targets on a phone, and the tab bar navigates.
// Needs a seeded throwaway database, so it only runs with E2E_LOCAL=1.

test.skip(!process.env.E2E_LOCAL, "needs a local app and a seeded throwaway database (E2E_LOCAL=1)");
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const PASSWORD = "EarthyPass!2345";
const email = `earthy.${Date.now()}@example.test`;
let orgId = "";

test("sign up and create an organisation", async ({ page }) => {
  const signUp = await page.request.post("/api/auth/sign-up/email", {
    data: { name: "Earthy", email, password: PASSWORD, acceptedTerms: true, termsVersion: TERMS_VERSION },
  });
  expect(signUp.status()).toBeLessThan(300);
  const org = await page.request.post("/api/orgs", { data: { name: `Earthy Builders ${Date.now()}`, hqCountry: "GB" } });
  expect(org.status()).toBeLessThan(300);
  orgId = (await org.json()).id;
  await page.context().storageState({ path: "test-results/earthy-summary-state.json" });
});

test.describe("signed in", () => {
  test.use({ storageState: "test-results/earthy-summary-state.json" });

  // The layout reads the preview cookie on the request after ?earthy=1 sets it.
  async function openSummary(page: import("@playwright/test").Page) {
    await page.goto(`/orgs/${orgId}/dashboard?earthy=1`, { waitUntil: "networkidle" });
    await page.goto(`/orgs/${orgId}/dashboard`, { waitUntil: "networkidle" });
  }

  for (const [name, width, height] of [["desktop", 1440, 900], ["phone", 390, 844]] as const) {
    test(`${name}: no horizontal overflow and no console errors`, async ({ page }) => {
      const errors: string[] = [];
      // A blocked tile or font host is the network, not the page.
      page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(m.text()); });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.setViewportSize({ width, height });
      await openSummary(page);
      const { scrollW, clientW } = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      expect(scrollW).toBeLessThanOrEqual(clientW);
      expect(errors).toEqual([]);
    });
  }

  test("phone: the tab bar has five 44px tabs and navigates", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSummary(page);
    const tabs = page.locator("nav.e-tabbar a");
    await expect(tabs).toHaveCount(5);
    for (const box of await tabs.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.locator('nav.e-tabbar [aria-current="page"]')).toHaveCount(1);
    await page.locator("nav.e-tabbar a", { hasText: "Records" }).click();
    await page.waitForURL(/\/records/);
  });

  test("phone: header buttons are at least 44px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSummary(page);
    const boxes = await page.locator("header button").evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect()).filter((b) => b.width > 0).map((b) => b.toJSON()),
    );
    for (const b of boxes) {
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("desktop: no tab bar", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSummary(page);
    await expect(page.locator("nav.e-tabbar")).toBeHidden();
  });
});
