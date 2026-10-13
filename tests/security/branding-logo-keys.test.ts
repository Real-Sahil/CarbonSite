import { describe, expect, it } from "vitest";
import { isOwnBrandingLogoKey, SERVABLE_LOGO_TYPES } from "@/lib/storage";

const ORG = "org_abc";

describe("branding logo keys", () => {
  it("accepts keys under the org's own branding prefix", () => {
    expect(isOwnBrandingLogoKey(ORG, `org/${ORG}/branding/logo-1.png`)).toBe(true);
  });

  it("rejects another org's keys and other prefixes (cross-tenant read)", () => {
    expect(isOwnBrandingLogoKey(ORG, "org/other/branding/logo.png")).toBe(false);
    expect(isOwnBrandingLogoKey(ORG, `org/${ORG}/audit-anchors/latest.json`)).toBe(false);
    expect(isOwnBrandingLogoKey(ORG, `org/${ORG}/evidence/e1/file.pdf`)).toBe(false);
    expect(isOwnBrandingLogoKey(ORG, `org/${ORG}/branding/../evidence/x`)).toBe(false);
  });

  it("serves raster types only, never SVG", () => {
    expect([...SERVABLE_LOGO_TYPES]).toEqual(["image/png", "image/jpeg", "image/webp"]);
    expect(SERVABLE_LOGO_TYPES).not.toContain("image/svg+xml");
  });
});
