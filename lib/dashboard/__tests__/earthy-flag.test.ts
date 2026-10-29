import { describe, expect, it } from "vitest";
import { earthyEnabled } from "../earthy-flag";

describe("earthyEnabled", () => {
  it("is on by default, for every organisation", () => {
    expect(earthyEnabled("o1", { env: "" })).toBe(true);
    expect(earthyEnabled("a-new-org", { env: "" })).toBe(true);
  });
  it("can be switched off for everyone with off", () => {
    expect(earthyEnabled("o1", { env: "off" })).toBe(false);
  });
  it("is on for everyone with *", () => {
    expect(earthyEnabled("o1", { env: "*" })).toBe(true);
  });
  it("is on only for listed organisations", () => {
    expect(earthyEnabled("o1", { env: "o2, o1" })).toBe(true);
    expect(earthyEnabled("o3", { env: "o2, o1" })).toBe(false);
  });
  it("lets an admin preview with ?earthy=1, nobody else", () => {
    expect(earthyEnabled("o1", { env: "off", previewParam: "1", isAdmin: true })).toBe(true);
    expect(earthyEnabled("o1", { env: "off", previewParam: "1", isAdmin: false })).toBe(false);
    expect(earthyEnabled("o1", { env: "", previewParam: "0", isAdmin: true })).toBe(false);
    expect(earthyEnabled("o1", { env: "", previewParam: "0", isAdmin: false })).toBe(true);
  });
});
