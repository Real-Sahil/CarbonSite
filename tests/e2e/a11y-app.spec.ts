import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { TERMS_VERSION } from "@/lib/legal/terms";

// WCAG 2.1 A and AA checks (axe-core) on signed-in pages. The public pages are
// covered by a11y.spec.ts; these are the pages a sustainability manager lives
// in. Needs a seeded throwaway database, so it only runs with E2E_LOCAL=1
// (CI's e2e-local job).

test.skip(!process.env.E2E_LOCAL, "needs a local app and a seeded throwaway database (E2E_LOCAL=1)");
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);
test.use({ contextOptions: { reducedMotion: "reduce" } });

const PAGES = ["dashboard", "records", "imports", "submissions", "calculations", "reports", "targets", "settings"];
const PASSWORD = "A11yPass!2345";
const email = `a11y.${Date.now()}@example.test`;
let orgId = "";

test("sign up and create an organisation", async ({ page }) => {
  const signUp = await page.request.post("/api/auth/sign-up/email", {
    data: { name: "A11y", email, password: PASSWORD, acceptedTerms: true, termsVersion: TERMS_VERSION },
  });
  expect(signUp.status()).toBeLessThan(300);
  const org = await page.request.post("/api/orgs", { data: { name: `A11y Builders ${Date.now()}`, hqCountry: "GB" } });
  expect(org.status()).toBeLessThan(300);
  orgId = (await org.json()).id;
  // Same cookies for the page checks below.
  await page.context().storageState({ path: "test-results/a11y-app-state.json" });
});

test.describe("signed in", () => {
  test.use({ storageState: "test-results/a11y-app-state.json" });

  for (const path of PAGES) {
    test(`/orgs/{org}/${path} has no WCAG 2.1 A/AA violations`, async ({ page }) => {
      await page.goto(`/orgs/${orgId}/${path}`, { waitUntil: "networkidle" });
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const summary = results.violations.map((v) => ({
        rule: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.slice(0, 5).map((n) => `${n.target.join(" ")}: ${n.any.map((a) => a.message).join("; ")}`),
      }));
      expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
    });
  }
});
