import { describe, expect, it, vi } from "vitest";
import { englandRegistration, lookupCarrier, parseRegister } from "../carrier-register";

// Shape taken from a live response of the Environment Agency register.
const live = {
  meta: { publisher: "Environment Agency", limit: 2000 },
  items: [
    {
      registrationNumber: "CBDU564741",
      expiryDate: "2028-01-08",
      holder: { name: "POWERDAY PLC", companyNumber: "01509382" },
      tier: { label: "Upper" },
      registrationType: { label: "Carrier, Broker, Dealer" },
    },
  ],
};
const now = new Date("2026-10-08T12:00:00Z");

describe("englandRegistration", () => {
  it("normalises CBDU and CBDL numbers and refuses others", () => {
    expect(englandRegistration("cbdu 564741")).toBe("CBDU564741");
    expect(englandRegistration("CBDL-12345")).toBe("CBDL12345");
    expect(englandRegistration("WCR/R/1234")).toBeNull();
    expect(englandRegistration(null)).toBeNull();
  });
});

describe("parseRegister", () => {
  it("reads a live registration", () => {
    expect(parseRegister(live, "CBDU564741", now)).toMatchObject({ status: "registered", holder: "POWERDAY PLC", tier: "Upper", expiryDate: "2028-01-08", companyNumber: "01509382" });
  });
  it("reports an expired registration as expired", () => {
    expect(parseRegister({ items: [{ ...live.items[0], expiryDate: "2026-10-01" }] }, "CBDU564741", now).status).toBe("expired");
  });
  it("requires an exact number match", () => {
    expect(parseRegister(live, "CBDU564742", now).status).toBe("not_found");
    expect(parseRegister({ items: [] }, "CBDU564741", now).status).toBe("not_found");
  });
  it("treats a broken body as unavailable, not as not registered", () => {
    expect(parseRegister({}, "CBDU564741", now).status).toBe("unavailable");
    expect(parseRegister(null, "CBDU564741", now).status).toBe("unavailable");
  });
});

describe("lookupCarrier", () => {
  it("does not call the register for a number it cannot check", async () => {
    const f = vi.fn();
    expect((await lookupCarrier("SEPA 1234", f as never)).status).toBe("not_checked");
    expect(f).not.toHaveBeenCalled();
  });
  it("asks for the exact number", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => live });
    const r = await lookupCarrier("cbdu564741", f as never);
    expect(r.status === "registered" || r.status === "expired").toBe(true);
    expect(String(f.mock.calls[0][0])).toContain("registrationNumber=CBDU564741");
  });
  it("is unavailable on a network error or a bad status", async () => {
    expect((await lookupCarrier("CBDU1234", vi.fn().mockRejectedValue(new Error("x")) as never)).status).toBe("unavailable");
    expect((await lookupCarrier("CBDU1234", vi.fn().mockResolvedValue({ ok: false }) as never)).status).toBe("unavailable");
  });
});
