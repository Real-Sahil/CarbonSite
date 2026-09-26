// @vitest-environment node
import { describe, expect, it } from "vitest";
import { FRAMEWORKS, assessableRequirements, headingCodes, sharedRequirements } from "../catalogue";
import { SIGNAL_KEYS } from "../signal-keys";
import { readiness, type RequirementState } from "../readiness";

describe("catalogue", () => {
  it("has unique framework slugs", () => {
    const slugs = FRAMEWORKS.map((f) => f.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  for (const f of FRAMEWORKS) {
    describe(f.slug, () => {
      it("has unique requirement codes, and every parent comes before its children", () => {
        const seen = new Set<string>();
        for (const r of f.requirements) {
          expect(seen.has(r.code), `duplicate ${r.code}`).toBe(false);
          if (r.parent) expect(seen.has(r.parent), `${r.code} names parent ${r.parent} before it appears`).toBe(true);
          seen.add(r.code);
        }
      });

      it("names only known signals", () => {
        for (const r of f.requirements) for (const s of r.signals ?? []) expect(SIGNAL_KEYS).toContain(s);
      });

      it("gives guidance on every requirement an organisation assesses", () => {
        for (const r of assessableRequirements(f)) expect(r.guidance, `${r.code} has no guidance`).toBeTruthy();
      });

      it("never carries official text unless it was copied from the official source", () => {
        if (f.contentBasis === "references") for (const r of f.requirements) expect(r.officialText, r.code).toBeUndefined();
      });

      it("puts no guidance on headings, which are not assessed", () => {
        const headings = headingCodes(f);
        for (const r of f.requirements) if (headings.has(r.code)) expect(r.guidance, `${r.code} is a heading`).toBeUndefined();
      });
    });
  }

  it("links each shared clause to the same clause in the other ISO management system standards", () => {
    const keys = new Map<string, string[]>();
    for (const f of FRAMEWORKS) for (const r of f.requirements) if (r.sharedKey) keys.set(r.sharedKey, [...(keys.get(r.sharedKey) ?? []), f.slug]);
    for (const [key, slugs] of keys) expect(slugs.length, `${key} appears only in ${slugs}`).toBeGreaterThan(1);
    expect(sharedRequirements("iso-14001-2015", "9.3").map((x) => `${x.framework.shortName} ${x.requirement.code}`).sort()).toEqual(["ISO 45001 9.3", "ISO 9001 9.3"]);
  });
});

describe("readiness", () => {
  const f = FRAMEWORKS.find((x) => x.slug === "iso-14001-2015")!;
  const total = assessableRequirements(f).length;

  it("counts untouched requirements as not started", () => {
    expect(readiness(f, new Map())).toMatchObject({ total, notStarted: total, implemented: 0, percent: 0 });
  });

  it("takes not-applicable requirements out of the denominator and flags implemented ones without evidence", () => {
    const states = new Map<string, RequirementState>([
      ["5.2", "implemented"],
      ["6.1.2", "implemented"],
      ["8.2", "not_applicable"],
      ["9.2.1", "in_progress"],
    ]);
    const r = readiness(f, states, new Map([["5.2", 2]]));
    expect(r).toMatchObject({ implemented: 2, notApplicable: 1, inProgress: 1, implementedWithoutEvidence: 1 });
    expect(r.percent).toBe(Math.round((2 / (total - 1)) * 100));
  });

  it("ignores statuses recorded against headings", () => {
    expect(readiness(f, new Map([["9.2", "implemented" as const]])).implemented).toBe(0);
  });
});
