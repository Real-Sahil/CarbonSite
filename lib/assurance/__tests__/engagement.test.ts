import { describe, it, expect } from "vitest";
import { checkSignOffReadiness, requiresQualification } from "../engagement";

describe("checkSignOffReadiness", () => {
  it("allows sign-off when there is nothing outstanding", () => {
    const result = checkSignOffReadiness({ findings: [], evidenceRequests: [] });
    expect(result.canSignOff).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("does not block on a minor or observation finding", () => {
    const result = checkSignOffReadiness({
      findings: [
        { severity: "minor", status: "open" },
        { severity: "observation", status: "open" },
      ],
      evidenceRequests: [],
    });
    expect(result.canSignOff).toBe(true);
  });

  it("blocks on an open significant finding", () => {
    const result = checkSignOffReadiness({
      findings: [{ severity: "significant", status: "open" }],
      evidenceRequests: [],
    });
    expect(result.canSignOff).toBe(false);
    expect(result.blockers[0]).toContain("1 significant or material finding");
  });

  it("blocks on a material misstatement that only has a management response", () => {
    const result = checkSignOffReadiness({
      findings: [{ severity: "material_misstatement", status: "management_responded" }],
      evidenceRequests: [],
    });
    expect(result.canSignOff).toBe(false);
  });

  it("allows sign-off once a significant finding is resolved or qualified", () => {
    const resolved = checkSignOffReadiness({
      findings: [{ severity: "significant", status: "resolved" }],
      evidenceRequests: [],
    });
    expect(resolved.canSignOff).toBe(true);

    const qualified = checkSignOffReadiness({
      findings: [{ severity: "material_misstatement", status: "qualified" }],
      evidenceRequests: [],
    });
    expect(qualified.canSignOff).toBe(true);
  });

  it("blocks on an outstanding evidence request", () => {
    const result = checkSignOffReadiness({
      findings: [],
      evidenceRequests: [{ reference: "PBC-01", status: "requested" }],
    });
    expect(result.canSignOff).toBe(false);
    expect(result.blockers[0]).toContain("PBC-01");
  });

  it("does not block on evidence marked provided or explicitly not available", () => {
    const result = checkSignOffReadiness({
      findings: [],
      evidenceRequests: [
        { reference: "PBC-01", status: "provided" },
        { reference: "PBC-02", status: "not_available" },
        { reference: "PBC-03", status: "not_applicable" },
      ],
    });
    expect(result.canSignOff).toBe(true);
  });

  it("lists all outstanding evidence references up to three, then truncates", () => {
    const result = checkSignOffReadiness({
      findings: [],
      evidenceRequests: [
        { reference: "PBC-01", status: "requested" },
        { reference: "PBC-02", status: "requested" },
        { reference: "PBC-03", status: "requested" },
        { reference: "PBC-04", status: "requested" },
      ],
    });
    expect(result.blockers[0]).toContain("PBC-01");
    expect(result.blockers[0]).toContain("PBC-02");
    expect(result.blockers[0]).toContain("PBC-03");
    expect(result.blockers[0]).toContain("…");
    expect(result.blockers[0]).not.toContain("PBC-04");
  });

  it("reports every category of blocker at once", () => {
    const result = checkSignOffReadiness({
      findings: [{ severity: "significant", status: "open" }],
      evidenceRequests: [{ reference: "PBC-01", status: "requested" }],
    });
    expect(result.blockers).toHaveLength(2);
  });
});

describe("requiresQualification", () => {
  it("is true only for material misstatement", () => {
    expect(requiresQualification("material_misstatement")).toBe(true);
    expect(requiresQualification("significant")).toBe(false);
    expect(requiresQualification("minor")).toBe(false);
    expect(requiresQualification("observation")).toBe(false);
  });
});
