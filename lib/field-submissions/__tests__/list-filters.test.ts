import { describe, expect, it } from "vitest";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, parseSubmissionFilters, submissionWhere } from "../list-filters";

describe("parseSubmissionFilters", () => {
  it("keeps known keys with valid values", () => {
    expect(
      parseSubmissionFilters({ status: "approved", documentType: "fuel_receipt", facilityId: "f1", contractId: "k1", periodId: "p1" }),
    ).toEqual({ status: "approved", documentType: "fuel_receipt", facilityId: "f1", contractId: "k1", periodId: "p1" });
  });
  it("drops unknown keys, off-list values, arrays and over-long ids instead of failing", () => {
    expect(
      parseSubmissionFilters({
        status: "pending", // not a tab
        documentType: "invoice",
        facilityId: "x".repeat(65),
        contractId: ["a", "b"],
        limit: "500",
        organizationId: "org-b",
      }),
    ).toEqual({});
  });
  it("treats an empty value as not set", () => {
    expect(parseSubmissionFilters({ status: "", facilityId: undefined })).toEqual({});
  });
});

describe("submissionWhere", () => {
  it("is always scoped to the organisation", () => {
    expect(submissionWhere("org-a", {})).toEqual({ organizationId: "org-a" });
    expect(submissionWhere("org-a", { organizationId: "org-b" } as Record<string, string>)).toEqual({ organizationId: "org-a" });
  });
  it("narrows by every filter, mapping periodId to the reporting period", () => {
    expect(
      submissionWhere("org-a", { status: "approved", documentType: "waste_ticket", facilityId: "f1", contractId: "k1", periodId: "p1" }),
    ).toEqual({
      organizationId: "org-a",
      status: "approved",
      documentType: "waste_ticket",
      facilityId: "f1",
      contractId: "k1",
      reportingPeriodId: "p1",
    });
  });
  it("leaves status out for the tab counts", () => {
    expect(submissionWhere("org-a", { status: "approved", facilityId: "f1" }, false)).toEqual({
      organizationId: "org-a",
      facilityId: "f1",
    });
  });
});

describe("document types", () => {
  it("has a plain label for every type", () => {
    expect(DOCUMENT_TYPES.every((t) => DOCUMENT_TYPE_LABELS[t].length > 0)).toBe(true);
    expect(DOCUMENT_TYPES).toHaveLength(8);
  });
});
