import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));

import { FRAMEWORKS, getFramework, headingCodes, successorOf, transitionMap } from "../catalogue";
import { SUPERSEDED_BY, countedFrameworks } from "../catalogue/editions";
import { planTransition } from "../transition";

const f14 = getFramework("iso-14001-2026")!;
const old14 = getFramework("iso-14001-2015")!;
const f9 = getFramework("iso-9001-2026")!;
const old9 = getFramework("iso-9001-2015")!;
const codes = (f: typeof f14) => f.requirements.map((r) => r.code);

describe("2026 editions", () => {
  it("keeps the billing edition map in step with the catalogue", () => {
    const fromCatalogue = Object.fromEntries(FRAMEWORKS.filter((f) => f.supersedes).map((f) => [f.supersedes!, f.slug]));
    expect(SUPERSEDED_BY).toEqual(fromCatalogue);
    expect(successorOf("iso-14001-2015")?.slug).toBe("iso-14001-2026");
  });

  it("lays out ISO 14001:2026 on the harmonized structure", () => {
    const c = codes(f14);
    expect(c.indexOf("6.1.5")).toBe(c.indexOf("6.1.4") + 1);
    expect(c.indexOf("6.3")).toBeGreaterThan(c.indexOf("6.2.2"));
    expect(c.indexOf("6.3")).toBeLessThan(c.indexOf("7"));
    expect(c.slice(c.indexOf("9.3"), c.indexOf("9.3") + 4)).toEqual(["9.3", "9.3.1", "9.3.2", "9.3.3"]);
    expect(c).not.toContain("10.3");
    expect(headingCodes(f14).has("9.3")).toBe(true);
    expect(f14.transitionDeadline).toBe("2029-04-30");
  });

  it("splits ISO 9001:2026 risks and opportunities and merges improvement into 10.1", () => {
    const c = codes(f9);
    expect(c.slice(c.indexOf("6.1"), c.indexOf("6.1") + 4)).toEqual(["6.1", "6.1.1", "6.1.2", "6.1.3"]);
    expect(c).not.toContain("10.3");
    expect(f9.requirements.find((r) => r.code === "10.1")!.editionChange?.from).toEqual(["10.1", "10.3"]);
  });

  it("maps every non-new requirement back to codes that exist in the old edition", () => {
    for (const [next, prev] of [[f14, old14], [f9, old9]] as const) {
      const old = new Set(codes(prev));
      for (const [code, { from, change }] of transitionMap(next, prev)) {
        for (const c of from) expect(old.has(c), `${next.slug} ${code} from ${c}`).toBe(true);
        if (change?.kind !== "new" && !headingCodes(next).has(code)) expect(from.length, `${next.slug} ${code}`).toBeGreaterThan(0);
      }
    }
  });

  it("counts an old edition once while its successor is held", () => {
    expect(countedFrameworks(["iso-14001-2015", "iso-14001-2026", "iso-45001-2018"])).toEqual(["iso-14001-2026", "iso-45001-2018"]);
    expect(countedFrameworks(["iso-14001-2015"])).toEqual(["iso-14001-2015"]);
  });
});

describe("planTransition", () => {
  const base = { ownerUserId: null, dueOn: null, notes: null, interpretation: null };
  const plan = planTransition(
    f14,
    old14,
    [
      { ...base, requirementCode: "7.2", status: "implemented", notes: "Training matrix in SharePoint", interpretation: "Site managers only" },
      { ...base, requirementCode: "8.1", status: "implemented" },
      { ...base, requirementCode: "10.1", status: "implemented" },
      { ...base, requirementCode: "10.3", status: "in_progress" },
      { ...base, requirementCode: "6.1.4", status: "implemented", ownerUserId: "u1" },
      { ...base, requirementCode: "9.3", status: "not_applicable" },
    ],
    [
      { requirementCode: "8.1", kind: "method_statement", targetId: "ms1", url: null, label: "Groundworks MS", note: null },
      { requirementCode: "9.3", kind: "note", targetId: null, url: null, label: "Review minutes", note: null },
    ],
  );
  const row = (code: string) => plan.statuses.find((s) => s.requirementCode === code);

  it("carries unchanged requirements as they were, with notes and interpretation", () => {
    expect(row("7.2")).toMatchObject({ status: "implemented", interpretation: "Site managers only" });
    expect(row("7.2")!.notes).toContain("Training matrix in SharePoint");
  });

  it("leaves changed requirements in progress for someone to check", () => {
    expect(row("8.1")!.status).toBe("in_progress");
    expect(row("8.1")!.notes).toContain("Check against the 2026 wording");
    expect(plan.toReview).toEqual(expect.arrayContaining(["8.1", "6.3", "6.1.4"]));
  });

  it("follows renumbered clauses and takes the least advanced state when two merge", () => {
    expect(row("6.1.5")).toMatchObject({ status: "implemented", ownerUserId: "u1" });
    expect(row("10.1")!.status).toBe("in_progress");
    expect(row("9.3.2")!.status).toBe("not_applicable");
  });

  it("starts new requirements empty and copies evidence to where it now belongs", () => {
    expect(row("6.3")).toBeUndefined();
    expect(plan.links.filter((l) => l.label === "Review minutes").map((l) => l.requirementCode)).toEqual(["9.3.1", "9.3.2", "9.3.3"]);
    expect(plan.links.find((l) => l.targetId === "ms1")!.requirementCode).toBe("8.1");
  });
});
