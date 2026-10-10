import { describe, expect, it } from "vitest";
import { TERMS_VERSION, termsAcceptedIn } from "../terms";

describe("termsAcceptedIn", () => {
  it("accepts a sign-up that ticks the box for the current Terms version", () => {
    expect(termsAcceptedIn({ email: "a@b.co", acceptedTerms: true, termsVersion: TERMS_VERSION })).toBe(true);
  });

  it("refuses a sign-up without the box, even with the version", () => {
    expect(termsAcceptedIn({ email: "a@b.co", termsVersion: TERMS_VERSION })).toBe(false);
    expect(termsAcceptedIn({ acceptedTerms: "true", termsVersion: TERMS_VERSION })).toBe(false);
  });

  it("refuses an older or unknown Terms version", () => {
    expect(termsAcceptedIn({ acceptedTerms: true, termsVersion: "2025-01" })).toBe(false);
    expect(termsAcceptedIn({ acceptedTerms: true })).toBe(false);
  });

  it("refuses a missing or non-object body", () => {
    expect(termsAcceptedIn(undefined)).toBe(false);
    expect(termsAcceptedIn("x")).toBe(false);
  });
});
