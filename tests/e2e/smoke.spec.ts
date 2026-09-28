import { test, expect } from "@playwright/test";

// Smoke tests: the app serves pages and the public API without server
// errors. CI runs them against the pull request's own production build (the
// e2e-local job); set PLAYWRIGHT_BASE_URL to point them at a deployed site.
// Production reachability is watched by .github/workflows/uptime.yml.

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
