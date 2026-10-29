import { describe, expect, it } from "vitest";
import { earthyEnabled } from "../earthy-flag";

describe("earthyEnabled", () => {
  it("is off by default", () => {
    expect(earthyEnabled("o1", { env: "" })).toBe(false);
  });
  it("is on for everyone with *", () => {
    expect(earthyEnabled("o1", { env: "*" })).toBe(true);
  });
  it("is on only for listed organisations", () => {
    expect(earthyEnabled("o1", { env: "o2, o1" })).toBe(true);
    expect(earthyEnabled("o3", { env: "o2, o1" })).toBe(false);
  });
  it("lets an admin preview with ?earthy=1, nobody else", () => {
    expect(earthyEnabled("o1", { env: "", previewParam: "1", isAdmin: true })).toBe(true);
    expect(earthyEnabled("o1", { env: "", previewParam: "1", isAdmin: false })).toBe(false);
    expect(earthyEnabled("o1", { env: "", previewParam: "0", isAdmin: true })).toBe(false);
  });
});
