import { describe, expect, it } from "vitest";
import { hvoShare } from "../fuels";

describe("HVO on a fuel type", () => {
  it("reads neat HVO and its common names", () => {
    expect(hvoShare("HVO")).toBe(1);
    expect(hvoShare("HVO100")).toBe(1);
    expect(hvoShare("HVO 100")).toBe(1);
    expect(hvoShare("Hydrotreated vegetable oil")).toBe(1);
    expect(hvoShare("renewable diesel")).toBe(1);
  });

  it("reads blends with diesel", () => {
    expect(hvoShare("HVO50")).toBe(0.5);
    expect(hvoShare("HVO-30 blend")).toBe(0.3);
    expect(hvoShare("Diesel with 20% HVO")).toBe(0.2);
  });

  it("ignores fuels that are not HVO", () => {
    expect(hvoShare("diesel")).toBeNull();
    expect(hvoShare("B7 diesel")).toBeNull();
    expect(hvoShare("")).toBeNull();
    expect(hvoShare(null)).toBeNull();
  });
});
