import { describe, expect, test } from "vitest";
import {
  displayUkPostcode,
  isLikelyUkPostcode,
  normalizeUkPostcode,
  RouteDistanceError,
} from "../route-distance";

describe("route distance postcode helpers", () => {
  test("normalizes and displays UK postcodes", () => {
    expect(normalizeUkPostcode("sw1a 1aa")).toBe("SW1A1AA");
    expect(displayUkPostcode("sw1a1aa")).toBe("SW1A 1AA");
  });

  test("validates likely UK postcode formats", () => {
    expect(isLikelyUkPostcode("SW1A 1AA")).toBe(true);
    expect(isLikelyUkPostcode("M1 1AE")).toBe(true);
    expect(isLikelyUkPostcode("not-a-postcode")).toBe(false);
  });

  test("carries structured API error metadata", () => {
    const error = new RouteDistanceError("INVALID_POSTCODE_FORMAT", "Invalid postcode", 422);

    expect(error.code).toBe("INVALID_POSTCODE_FORMAT");
    expect(error.status).toBe(422);
    expect(error.message).toBe("Invalid postcode");
  });
});
