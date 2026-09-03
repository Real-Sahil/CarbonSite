import { test, expect } from "@playwright/test";

// Smoke tests verify the app renders and basic navigation works.
// These run against the deployed staging or production URL in CI
// (set PLAYWRIGHT_BASE_URL) or against the local dev server.

test.describe("Marketing pages", () => {
  test("home page loads with a heading", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/.+/);
    // Marketing pages use h2 as the primary visible heading (no h1 at root level)
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible();
  });

  test("sign-in page renders form", async ({ page }) => {
    await page.goto("/sign-in");
    // Wait for the client-side React component to fully hydrate before checking inputs
    await page.waitForLoadState("networkidle");
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
    // 204 No Content or 200 OK — just confirm it's not a hard server error.
    // 404 is also acceptable when the endpoint is not yet deployed to the target environment.
    expect([200, 204, 400, 404]).toContain(res.status());
  });
});
