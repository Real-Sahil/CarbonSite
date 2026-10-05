// @vitest-environment node
// Every "fix it here" link the app offers beside something missing must open a real page.
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CHECK_LINKS as CRP } from "@/lib/crp/plan";
import { CHECK_LINKS as TRANSITION } from "@/lib/transition-plan/index";
import { CHECK_LINKS as TCFD } from "@/lib/climate-disclosure/index";
import { buildChecklist } from "../monthly";

const ORG = "app/(app)/orgs/[orgId]";
const pageExists = (rel: string) => existsSync(path.join(process.cwd(), ORG, rel.split("?")[0], "page.tsx"));

const everything = buildChecklist({
  month: "2026-09", hasPeriod: false, fieldSubmissionsWaiting: 1, recordsInReview: 1, importsWaiting: 1, billsInInbox: 1, ledgerLinesWaiting: 1,
  recordsWithoutEvidence: 1, approvedChangedSinceRun: 1, hasRun: true, hasApprovedRecords: true,
  missingSources: Array.from({ length: 10 }, (_, k) => ({ facility: `S${k}`, category: "Gas", seenIn: ["2026-07", "2026-08"] })),
});

describe("fix links open real pages", () => {
  it.each([
    ["CRP checks", Object.values(CRP).map((l) => l.path)],
    ["transition plan checks", Object.values(TRANSITION).map((l) => l.path)],
    ["TCFD checks", Object.values(TCFD).map((l) => l.path)],
    ["monthly checklist", everything.flatMap((i) => i.fixes.map((f) => f.path))],
  ])("%s", (_name, paths) => {
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) expect(pageExists(p), `no page for "${p}"`).toBe(true);
  });
});
