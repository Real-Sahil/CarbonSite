import { describe, it, expect } from "vitest";
import { computeCellStatus, gradeCells, summarizeCompleteness } from "../completeness";

describe("computeCellStatus", () => {
  it("is not_required when the cell isn't expected to report", () => {
    expect(computeCellStatus({ required: false, recordCount: 0, approvedCount: 0 })).toBe("not_required");
    expect(computeCellStatus({ required: false, recordCount: 5, approvedCount: 5 })).toBe("not_required");
  });

  it("is green when at least one record is approved", () => {
    expect(computeCellStatus({ required: true, recordCount: 3, approvedCount: 1 })).toBe("green");
  });

  it("is amber when records exist but none are approved", () => {
    expect(computeCellStatus({ required: true, recordCount: 2, approvedCount: 0 })).toBe("amber");
  });

  it("is red when required but nothing has been submitted", () => {
    expect(computeCellStatus({ required: true, recordCount: 0, approvedCount: 0 })).toBe("red");
  });
});

describe("gradeCells", () => {
  it("attaches a status to each cell", () => {
    const graded = gradeCells([
      { facilityId: "f1", emissionCategoryId: "c1", required: true, ownerUserId: null, recordCount: 0, approvedCount: 0 },
      { facilityId: "f1", emissionCategoryId: "c2", required: true, ownerUserId: null, recordCount: 1, approvedCount: 1 },
    ]);
    expect(graded[0].status).toBe("red");
    expect(graded[1].status).toBe("green");
  });
});

describe("summarizeCompleteness", () => {
  it("excludes not_required cells from the denominator", () => {
    const cells = gradeCells([
      { facilityId: "f1", emissionCategoryId: "c1", required: true, ownerUserId: null, recordCount: 1, approvedCount: 1 },
      { facilityId: "f1", emissionCategoryId: "c2", required: true, ownerUserId: null, recordCount: 0, approvedCount: 0 },
      { facilityId: "f1", emissionCategoryId: "c3", required: false, ownerUserId: null, recordCount: 0, approvedCount: 0 },
    ]);
    const summary = summarizeCompleteness(cells);
    expect(summary.totalRequired).toBe(2);
    expect(summary.green).toBe(1);
    expect(summary.red).toBe(1);
    expect(summary.completenessPercent).toBeCloseTo(50);
  });

  it("returns 0% completeness when nothing is required", () => {
    const summary = summarizeCompleteness([]);
    expect(summary.completenessPercent).toBe(0);
    expect(summary.totalRequired).toBe(0);
  });

  it("returns 100% completeness when every required cell is green", () => {
    const cells = gradeCells([
      { facilityId: "f1", emissionCategoryId: "c1", required: true, ownerUserId: null, recordCount: 2, approvedCount: 2 },
      { facilityId: "f1", emissionCategoryId: "c2", required: true, ownerUserId: null, recordCount: 1, approvedCount: 1 },
    ]);
    expect(summarizeCompleteness(cells).completenessPercent).toBe(100);
  });
});
