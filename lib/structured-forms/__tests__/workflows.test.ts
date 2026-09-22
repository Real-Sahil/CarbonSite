import { describe, expect, it } from "vitest";
import {
  AssessmentStatus,
  EngagementStatus,
  HsIncidentStatus,
  IncidentStatus,
  PermitStatus,
} from "@prisma/client";
import { WORKFLOWS, isLockedStatus, nextMajorVersion, type StructuredFormKey } from "../workflows";

const ENUMS: Record<StructuredFormKey, Record<string, string>> = {
  "hs-incident-reports": HsIncidentStatus,
  "environmental-incidents": IncidentStatus,
  "environmental-permits": PermitStatus,
  "assurance-engagements": EngagementStatus,
  "biodiversity-assessments": AssessmentStatus,
};

describe("structured form workflows", () => {
  for (const [form, workflow] of Object.entries(WORKFLOWS) as Array<[StructuredFormKey, (typeof WORKFLOWS)[StructuredFormKey]]>) {
    const enumValues = Object.values(ENUMS[form]).sort();

    it(`${form}: labels every database status and nothing else`, () => {
      expect(Object.keys(workflow.statuses).sort()).toEqual(enumValues);
    });

    it(`${form}: transitions and lock statuses only use real statuses`, () => {
      const used = [
        ...Object.keys(workflow.transitions),
        ...Object.values(workflow.transitions).flat().map((t) => t.to),
        ...workflow.lockStatuses,
        ...(workflow.revise?.from ?? []),
        ...(workflow.revise?.reopenTo ? [workflow.revise.reopenTo] : []),
      ];
      for (const status of used) expect(enumValues).toContain(status);
    });

    it(`${form}: locked statuses offer no content-editing transitions`, () => {
      for (const status of workflow.lockStatuses) {
        const reopensViaTransition = (workflow.transitions[status] ?? []).length > 0;
        const reopensViaRevise = workflow.revise?.from.includes(status) ?? false;
        // A locked record may only move on through an explicit admin action, never silently.
        expect(reopensViaTransition && !reopensViaRevise).toBe(false);
      }
    });
  }

  it("reopening an incident unlocks it", () => {
    const reopenTo = WORKFLOWS["hs-incident-reports"].revise?.reopenTo;
    expect(reopenTo).toBeDefined();
    expect(isLockedStatus("hs-incident-reports", reopenTo!)).toBe(false);
  });

  it("a signed assurance opinion cannot be revised", () => {
    expect(WORKFLOWS["assurance-engagements"].revise).toBeNull();
    expect(isLockedStatus("assurance-engagements", "signed")).toBe(true);
  });

  it("bumps the major version", () => {
    expect(nextMajorVersion("1.0")).toBe("2.0");
    expect(nextMajorVersion("3.2")).toBe("4.0");
    expect(nextMajorVersion("garbage")).toBe("2.0");
  });
});
