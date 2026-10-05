import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// WCAG 2.1 A and AA checks (axe-core) on the public pages buyers and
// evaluators see first. Runs in CI's e2e-local job against the build of the
// pull request itself, so a fix is checked before it ships; a run pointed at
// a deployed site skips it.

test.skip(!process.env.E2E_LOCAL, "runs against the local build in CI's e2e-local job (E2E_LOCAL=1)");

// The scroll effects (components/marketing/string-tune.tsx) fade content in, and axe would read
// the colours mid-fade. Reduced motion is the page in its final state, which is what is checked.
test.use({ contextOptions: { reducedMotion: "reduce" } });

const PAGES = ["/", "/product", "/pricing", "/methodology", "/security", "/sign-in", "/sign-up"];

for (const path of PAGES) {
  test(`${path} has no WCAG 2.1 A/AA violations`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
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
