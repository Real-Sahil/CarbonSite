import { describe, expect, it } from "vitest";
import { carrierAskEmail, missingFields } from "../carrier-ask";

describe("missingFields", () => {
  it("lists what the reading did not find, in order", () => {
    expect(missingFields({ reference: "WTN1", tonnes: 4, date: "2026-10-01", ewc: "17 09 04" })).toEqual(["carrier registration number"]);
    expect(missingFields(null)).toHaveLength(5);
  });
  it("treats an empty string as missing", () => {
    expect(missingFields({ reference: "", tonnes: 0, date: "2026-10-01", ewc: "17 09 04", carrierRegistration: "CBDU1" })).toEqual(["transfer note reference"]);
  });
});

describe("carrierAskEmail", () => {
  it("names the sender, the note and each gap, and escapes HTML", () => {
    const m = carrierAskEmail({ orgName: "Sisk <Ltd>", senderName: "Abigail", noteTitle: "WTN & 7", missing: ["weight in tonnes"], note: "Please hurry" });
    expect(m.text).toContain("Abigail at Sisk <Ltd>");
    expect(m.text).toContain("- weight in tonnes");
    expect(m.text).toContain("Please hurry");
    expect(m.html).toContain("Sisk &lt;Ltd&gt;");
    expect(m.html).toContain("WTN &amp; 7");
    expect(m.html).not.toContain("<Ltd>");
  });
});
