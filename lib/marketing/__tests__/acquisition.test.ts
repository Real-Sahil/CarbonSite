import { describe, expect, it } from "vitest";
import { acquisitionFromParams, referrerSource, withAcquisition } from "../acquisition";
import { createOrgSchema, updateOrgSchema } from "@/lib/validation/org";

describe("acquisition", () => {
  it("prefers ref over utm_source and keeps medium and campaign", () => {
    const q = new URLSearchParams("utm_source=LinkedIn&ref=verify&utm_medium=pdf&utm_campaign=crp");
    expect(acquisitionFromParams(q)).toEqual({ source: "verify", medium: "pdf", campaign: "crp" });
  });

  it("falls back to an external referrer host and ignores its own host", () => {
    expect(referrerSource("https://www.linkedin.com/feed/", "www.metricora.co.uk")).toBe("linkedin.com");
    expect(referrerSource("https://www.metricora.co.uk/pricing", "metricora.co.uk")).toBeUndefined();
    expect(referrerSource("", "metricora.co.uk")).toBeUndefined();
    expect(acquisitionFromParams(new URLSearchParams(), "google.com")).toEqual({ source: "google.com", medium: undefined, campaign: undefined });
    expect(acquisitionFromParams(new URLSearchParams())).toBeNull();
  });

  it("drops values that are not simple tokens", () => {
    expect(acquisitionFromParams(new URLSearchParams("ref=<script>&utm_source=ok"))?.source).toBe("ok");
    expect(acquisitionFromParams(new URLSearchParams("ref=" + "a".repeat(61)))).toBeNull();
  });

  it("adds the parameters to an internal link once, keeping its query and hash", () => {
    const a = { source: "verify", medium: "pdf" };
    expect(withAcquisition("/sign-up", a)).toBe("/sign-up?ref=verify&utm_medium=pdf");
    expect(withAcquisition("/pricing?plan=growth#faq", a)).toBe("/pricing?plan=growth&ref=verify&utm_medium=pdf#faq");
    expect(withAcquisition("/sign-up?ref=other", a)).toBe("/sign-up?ref=other");
  });

  it("is accepted on creation only and never blocks it", () => {
    expect(createOrgSchema.parse({ name: "Acme", acquisition: { source: "verify" } }).acquisition).toEqual({ source: "verify" });
    expect(createOrgSchema.parse({ name: "Acme", acquisition: { source: "bad value!" } }).acquisition).toBeUndefined();
    expect(updateOrgSchema.parse({ acquisition: { source: "verify" } })).not.toHaveProperty("acquisition");
  });
});
