import { describe, expect, it, vi } from "vitest";
import {
  distanceMiles,
  normalisePostcode,
  summariseLocalSpend,
  supplierKey,
} from "@/lib/social-value/local-spend";
import { geocodePostcodes } from "@/lib/social-value/geocode";

const reading = { latitude: 51.4543, longitude: -0.9781 };
const oxford = { latitude: 51.752, longitude: -1.2577 };
const leeds = { latitude: 53.8008, longitude: -1.5491 };

describe("distanceMiles", () => {
  it("is about 24 miles Reading to Oxford and 0 to itself", () => {
    expect(distanceMiles(reading, oxford)).toBeGreaterThan(22);
    expect(distanceMiles(reading, oxford)).toBeLessThan(26);
    expect(distanceMiles(reading, reading)).toBe(0);
  });
});

describe("supplierKey and postcodes", () => {
  it("matches the same supplier written differently", () => {
    expect(supplierKey("Smith & Sons Ltd.")).toBe(supplierKey("SMITH AND SONS LIMITED"));
    expect(supplierKey("The Aggregates Co")).toBe(supplierKey("aggregates"));
  });
  it("normalises UK postcodes and rejects other text", () => {
    expect(normalisePostcode("rg12ab")).toBe("RG1 2AB");
    expect(normalisePostcode(" SW1A 1AA ")).toBe("SW1A 1AA");
    expect(normalisePostcode("not a postcode")).toBeNull();
  });
});

describe("summariseLocalSpend", () => {
  const suppliers = [
    { key: supplierKey("Near Aggregates"), name: "Near Aggregates", ...oxford, sme: true },
    { key: supplierKey("Far Steel"), name: "Far Steel", ...leeds, sme: false },
    { key: supplierKey("No Postcode Ltd"), name: "No Postcode Ltd", latitude: null, longitude: null, sme: null },
  ];
  const lines = [
    { supplierName: "Near Aggregates Ltd", amount: 6000, currency: "GBP" },
    { supplierName: "Far Steel", amount: 4000, currency: "GBP" },
    { supplierName: "No Postcode Ltd", amount: 2500, currency: "GBP" },
    { supplierName: "Unknown Co", amount: 500, currency: "GBP" },
    { supplierName: null, amount: 700, currency: "GBP" },
    { supplierName: "Near Aggregates", amount: 900, currency: "EUR" },
  ];

  it("counts only placed GBP spend in the share and keeps the rest apart", () => {
    const s = summariseLocalSpend(lines, suppliers, reading, 30);
    expect(s.totalGbp).toBe(10000);
    expect(s.localGbp).toBe(6000);
    expect(s.localPct).toBe(60);
    expect(s.smePct).toBe(60);
    expect(s.localSmeGbp).toBe(6000);
    expect(s.unplaced).toEqual({ noSupplierGbp: 700, unlocatedGbp: 3000, notGbpLines: 1 });
    expect(s.missingLocations.map((m) => m.name)).toEqual(["No Postcode Ltd", "Unknown Co"]);
    expect(s.topLocal[0].name).toBe("Near Aggregates");
  });

  it("a smaller radius excludes the 24-mile supplier", () => {
    expect(summariseLocalSpend(lines, suppliers, reading, 20).localPct).toBe(0);
  });

  it("returns null shares when nothing could be placed", () => {
    const s = summariseLocalSpend([{ supplierName: "X", amount: 10, currency: "GBP" }], [], reading);
    expect(s.localPct).toBeNull();
    expect(s.smePct).toBeNull();
  });
});

describe("geocodePostcodes", () => {
  it("sends only postcodes and maps null results", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const sent = JSON.parse(String(init.body));
      expect(Object.keys(sent)).toEqual(["postcodes"]);
      return new Response(
        JSON.stringify({
          result: [
            { query: "RG1 2AB", result: { latitude: 51.45, longitude: -0.97 } },
            { query: "ZZ9 9ZZ", result: null },
          ],
        }),
        { status: 200 },
      );
    });
    const out = await geocodePostcodes(["rg12ab", "ZZ9 9ZZ", "junk"], fetchMock as unknown as typeof fetch);
    expect(out.get("RG1 2AB")).toEqual({ latitude: 51.45, longitude: -0.97 });
    expect(out.get("ZZ9 9ZZ")).toBeNull();
    expect(out.has("junk")).toBe(false);
  });
});
