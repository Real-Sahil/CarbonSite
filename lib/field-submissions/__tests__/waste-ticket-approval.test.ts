// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { approvalBlocker, type ApprovableSubmission } from "../approve";

const ticket = (formData: object) =>
  ({ id: "sub-1", documentType: "waste_ticket", formData, ocrExtractedData: null, facilityId: "fac-1" }) as unknown as ApprovableSubmission;

describe("approvalBlocker for waste tickets", () => {
  it("approves a mass weight with a recognised disposal route", () => {
    expect(approvalBlocker(ticket({ weight: 1.2, weightUnit: "tonne", disposalRoute: "recycling_mixed" }), "cat-1", "fac-1")).toBeNull();
  });

  it("refuses a volume, which would otherwise be booked as tonnes", () => {
    expect(approvalBlocker(ticket({ weight: 2, weightUnit: "m3", disposalRoute: "landfill_mixed" }), "cat-1", "fac-1")?.code).toBe("INVALID_FORM_DATA");
    expect(approvalBlocker(ticket({ weight: 500, weightUnit: "litre", disposalRoute: "landfill_mixed" }), "cat-1", "fac-1")?.code).toBe("INVALID_FORM_DATA");
  });

  it("refuses a ticket with no disposal route, rather than defaulting it to recycling", () => {
    expect(approvalBlocker(ticket({ weight: 1 }), "cat-1", "fac-1")?.code).toBe("INVALID_FORM_DATA");
  });

  it("refuses a disposal route it does not recognise", () => {
    expect(approvalBlocker(ticket({ weight: 1, disposalRoute: "dump" }), "cat-1", "fac-1")?.code).toBe("INVALID_FORM_DATA");
  });
});
