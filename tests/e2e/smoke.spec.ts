import { test, expect } from "@playwright/test";

// Smoke tests verify the deployed app is reachable and responds without
// server errors. They run against the production or staging URL in CI
// (set PLAYWRIGHT_BASE_URL) or against the local dev server.

test.describe("Marketing pages", () => {
  test("home page loads", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(500);
    await expect(page).toHaveTitle(/.+/);
  });

  test("sign-in page loads", async ({ page }) => {
    const response = await page.goto("/sign-in");
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe("Public API health", () => {
  test("CSP report endpoint accepts POST", async ({ request }) => {
    const res = await request.post("/api/csp-report", {
      data: { "csp-report": {} },
      headers: { "Content-Type": "application/csp-report" },
    });
    expect(res.status()).toBeLessThan(500);
  });
});
