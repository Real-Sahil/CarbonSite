import { describe, expect, it, vi } from "vitest";
import { lookupPermit, parsePermit, permitReference } from "../permit-register";

// Shapes taken from live responses of the Environment Agency registers (9 Oct 2026).
const permit = {
  items: [
    {
      registrationNumber: "NP3890VV",
      holder: { name: "FCC WASTE SERVICES (UK) LIMITED" },
      status: { comment: "Effective" },
      site: { premises: "Sutton Courtenay Materials Recycling Facility - EPR/NP3890VV", siteAddress: { address: "Appleford Sidings, Sutton Courtenay, Oxfordshire, OX14 4PW" }, siteType: { description: "A12 : Clinical Waste Transfer Station" } },
    },
  ],
};
const exemption = {
  items: [
    {
      registrationNumber: "EXP/AP3041YF",
      holder: { name: "MAC4SALE LTD" },
      exemption: [{ expiryDate: "2027-04-27", registrationType: { notation: "T11" } }],
      site: [{ siteAddress: { address: "Unit 1 Brick Kiln Works, New Road, Childrey, Wantage, OX12 9PG" } }],
    },
  ],
};
const now = new Date("2026-10-09T12:00:00Z");

describe("permitReference", () => {
  it("normalises England permit and exemption numbers and refuses others", () => {
    expect(permitReference("epr/np3890vv", "site_permit")).toBe("NP3890VV");
    expect(permitReference("NP 3890 VV", "site_permit")).toBe("NP3890VV");
    expect(permitReference("exp-ap3041yf", "exemption")).toBe("EXP/AP3041YF");
    expect(permitReference("T11", "exemption")).toBeNull();
    expect(permitReference("102053", "site_permit")).toBeNull();
  });
});

describe("parsePermit", () => {
  it("reads an effective permit", () => {
    expect(parsePermit(permit, "NP3890VV", now)).toMatchObject({ status: "effective", holder: "FCC WASTE SERVICES (UK) LIMITED", siteType: "A12 : Clinical Waste Transfer Station", registerStatus: "Effective" });
  });
  it("does not call a surrendered permit effective", () => {
    const r = parsePermit({ items: [{ ...permit.items[0], status: { comment: "Surrendered" } }] }, "NP3890VV", now);
    expect(r.status).toBe("not_effective");
  });
  it("reads an exemption and its codes, and expires it", () => {
    expect(parsePermit(exemption, "EXP/AP3041YF", now)).toMatchObject({ status: "effective", codes: ["T11"], expiryDate: "2027-04-27", holder: "MAC4SALE LTD" });
    expect(parsePermit(exemption, "EXP/AP3041YF", new Date("2027-05-01")).status).toBe("not_effective");
  });
  it("needs an exact match and treats a broken body as unavailable", () => {
    expect(parsePermit(permit, "NP3890VW", now).status).toBe("not_found");
    expect(parsePermit({ items: [] }, "NP3890VV", now).status).toBe("not_found");
    expect(parsePermit({}, "NP3890VV", now).status).toBe("unavailable");
  });
});

describe("lookupPermit", () => {
  it("asks the right register with the exemption's slash form", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => exemption });
    expect((await lookupPermit("exemption", "exp-ap3041yf", f as never)).status).toBe("effective");
    expect(f.mock.calls[0][0]).toContain("/waste-exemptions/registration.json?registrationNumber=EXP%2FAP3041YF");
  });
  it("is unavailable, never 'no permit', when the register fails; and never calls for a number it cannot check", async () => {
    expect((await lookupPermit("site_permit", "NP3890VV", (async () => { throw new Error("down"); }) as never)).status).toBe("unavailable");
    const f = vi.fn();
    expect((await lookupPermit("site_permit", "SEPA 1234", f as never)).status).toBe("not_checked");
    expect(f).not.toHaveBeenCalled();
  });
});
