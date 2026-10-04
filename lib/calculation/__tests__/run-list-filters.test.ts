import { describe, expect, it } from "vitest";
import { RUN_STATUSES, RUN_STATUS_LABELS, parseRunFilters, runWhere } from "../run-list-filters";

describe("parseRunFilters", () => {
  it("keeps known keys with valid values", () => {
    expect(parseRunFilters({ status: "failed", periodId: "p1", factorLibraryId: "lib1" })).toEqual({
      status: "failed",
      periodId: "p1",
      factorLibraryId: "lib1",
    });
  });
  it("drops unknown keys, off-list statuses, arrays and over-long ids instead of failing", () => {
    expect(
      parseRunFilters({ status: "cancelled", periodId: "x".repeat(65), factorLibraryId: ["a"], organizationId: "org-b" }),
    ).toEqual({});
  });
});

describe("runWhere", () => {
  it("is always scoped to the organisation", () => {
    expect(runWhere("org-a", {})).toEqual({ organizationId: "org-a" });
    expect(runWhere("org-a", { organizationId: "org-b" } as Record<string, string>)).toEqual({ organizationId: "org-a" });
  });
  it("maps each filter to its column", () => {
    expect(runWhere("org-a", { status: "running", periodId: "p1", factorLibraryId: "lib1" })).toEqual({
      organizationId: "org-a",
      status: "running",
      reportingPeriodId: "p1",
      factorLibraryId: "lib1",
    });
  });
});

describe("run statuses", () => {
  it("has a label for each", () => {
    expect(RUN_STATUSES.map((s) => RUN_STATUS_LABELS[s])).toEqual(["Queued", "Running", "Succeeded", "Failed"]);
  });
});
