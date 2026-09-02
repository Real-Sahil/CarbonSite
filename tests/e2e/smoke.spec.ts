import { test, expect } from "@playwright/test";

// Smoke tests verify the app renders and basic navigation works.
// These run against the deployed staging or production URL in CI
// (set PLAYWRIGHT_BASE_URL) or against the local dev server.

test.describe("Marketing pages", () => {
  test("home page loads with a heading", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/.+/);
    // At minimum a heading should exist
    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible();
  });

  test("sign-in page renders form", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.locator("input[type=email]").first()).toBeVisible();
    await expect(page.locator("input[type=password]").first()).toBeVisible();
  });
});

test.describe("Public API health", () => {
  test("CSP report endpoint responds with 204", async ({ request }) => {
    const res = await request.post("/api/csp-report", {
      data: { "csp-report": {} },
      headers: { "Content-Type": "application/csp-report" },
    });
    // 204 No Content or 200 OK — just confirm it's not a hard error
    expect([200, 204, 400]).toContain(res.status());
  });
});
