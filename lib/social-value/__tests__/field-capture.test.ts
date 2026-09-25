import { describe, expect, it } from "vitest";
import { evidenceLinks, socialValueEntry } from "../field-capture";
import { approvalBlocker, type ApprovableSubmission } from "@/lib/field-submissions/approve";

describe("socialValueEntry", () => {
  it("reads a complete entry", () => {
    const r = socialValueEntry({ commitmentId: "c1", quantity: "3", activityDate: "2026-09-01", note: " Two apprentices started " });
    expect(r).toEqual({ entry: { commitmentId: "c1", quantity: 3, activityDate: "2026-09-01", note: "Two apprentices started" } });
  });

  it("needs a KPI and a positive quantity", () => {
    expect(socialValueEntry({ quantity: 2 })).toEqual({ error: expect.stringContaining("KPI") });
    expect(socialValueEntry({ commitmentId: "c1", quantity: 0 })).toEqual({ error: expect.stringContaining("above zero") });
    expect(socialValueEntry({ commitmentId: "c1", quantity: "abc" })).toEqual({ error: expect.stringContaining("above zero") });
  });

  it("rejects a malformed date and allows none", () => {
    expect(socialValueEntry({ commitmentId: "c1", quantity: 1, activityDate: "01/09/2026" })).toEqual({ error: expect.stringContaining("YYYY-MM-DD") });
    expect(socialValueEntry({ commitmentId: "c1", quantity: 1 })).toMatchObject({ entry: { activityDate: null, note: null } });
  });

  it("caps the note at 500 characters", () => {
    const r = socialValueEntry({ commitmentId: "c1", quantity: 1, note: "x".repeat(900) });
    expect("entry" in r && r.entry.note?.length).toBe(500);
  });
});

describe("evidenceLinks", () => {
  it("builds absolute org evidence download links", () => {
    expect(evidenceLinks("o1", ["e1"], "https://app.example")).toEqual(["https://app.example/api/orgs/o1/evidence/e1/download"]);
  });
});

describe("approvalBlocker for social value", () => {
  const base = { documentType: "social_value", ocrExtractedData: null, files: [] } as unknown as ApprovableSubmission;

  it("needs no emission category", () => {
    expect(approvalBlocker({ ...base, formData: { commitmentId: "c1", quantity: 2 } } as ApprovableSubmission, null)).toBeNull();
  });

  it("blocks an entry without a quantity", () => {
    expect(approvalBlocker({ ...base, formData: { commitmentId: "c1" } } as ApprovableSubmission, null)?.code).toBe("INVALID_FORM_DATA");
  });
});
