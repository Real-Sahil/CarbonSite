import { describe, expect, test } from "vitest";
import { RouteDistanceError } from "@/lib/geo/route-distance";
import { handleRouteError } from "../api";

describe("handleRouteError", () => {
  test("returns structured route-distance errors as API responses", async () => {
    const response = handleRouteError(
      new RouteDistanceError(
        "INVALID_POSTCODE_FORMAT",
        "Pickup and delivery postcodes must be valid UK postcode formats.",
        422,
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.code).toBe("INVALID_POSTCODE_FORMAT");
    expect(body.message).toContain("valid UK postcode");
  });
});
