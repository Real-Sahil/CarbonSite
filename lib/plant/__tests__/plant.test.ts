// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { differenceReadings, iso15143Snapshot, snapshotCumulatives } from "../telematics";
import { fuelFactor, reconcileSites, summarisePlant, type PlantFactors } from "../analytics";

const db = vi.hoisted(() => {
  const model = () => ({ findFirst: vi.fn(), findMany: vi.fn(), createMany: vi.fn(), create: vi.fn() });
  return { plantAsset: model(), plantTelematicsReading: model() };
});
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/auth/api-key", () => ({ validateApiKey: vi.fn().mockResolvedValue("org-a") }));
vi.mock("@/lib/security/rate-limit-async", () => ({ rateLimitRequest: vi.fn().mockResolvedValue(null) }));

const snapshot = iso15143Snapshot.parse({
  SnapshotTime: "2026-05-02T06:00:00Z",
  Equipment: [
    {
      EquipmentHeader: { OEMName: "CAT", Model: "320", SerialNumber: "CAT320-01" },
      CumulativeOperatingHours: { datetime: "2026-05-02T06:00:00Z", Hour: 1250.5 },
      CumulativeIdleHours: { Hour: 300.5 },
      FuelUsed: { FuelUnits: "litre", FuelConsumed: 20100 },
    },
    { EquipmentHeader: { Model: "no serial" } },
    {
      EquipmentHeader: { OEMName: "JCB", Model: "540", PIN: "JCB540-9" },
      CumulativeOperatingHours: { Hour: 40 },
      FuelUsed: { FuelUnits: "gallon", FuelConsumed: 10 },
    },
  ],
});

describe("ISO 15143-3 snapshots", () => {
  it("reads machines by serial or PIN, converts gallons, and skips unidentified ones", () => {
    const { readings, skipped } = snapshotCumulatives(snapshot);
    expect(readings.map((r) => r.serialNumber)).toEqual(["CAT320-01", "JCB540-9"]);
    expect(readings[1].fuelLitres).toBeCloseTo(37.854, 2);
    expect(skipped).toEqual(["no serial"]);
  });

  it("differences cumulative counters, and refuses a reset counter", () => {
    const cur = snapshotCumulatives(snapshot).readings[0];
    const prev = { at: new Date("2026-05-01T06:00:00Z"), hours: 1242, idleHours: 298, fuelLitres: 20000 };
    expect(differenceReadings(prev, cur)).toMatchObject({ operatingHours: 8.5, idleHours: 2.5, fuelLitres: 100 });
    expect(differenceReadings({ ...prev, fuelLitres: 99999 }, cur)?.fuelLitres).toBeNull();
    expect(differenceReadings(null, cur)).toBeNull();
    expect(differenceReadings({ ...prev, at: cur.at }, cur)).toBeNull();
  });
});

const factors: PlantFactors = {
  diesel: { externalId: "defra-2026-diesel-litre", kgCo2ePerLitre: 2.58354, biogenicKgPerLitre: 0.14 },
  hvo: { externalId: "defra-2026-hvo-litre", kgCo2ePerLitre: 0.03558, biogenicKgPerLitre: 2.43 },
  library: "DEFRA 2026.1",
};
const asset = (id: string, fuelType: string, siteId: string | null = "s1") => ({
  id, name: id, category: null, fuelType, siteId, siteName: siteId, ownership: "owned", autoRegistered: false,
});

describe("plant analytics", () => {
  it("prices fuel as diesel, HVO or a blend, and leaves electric at zero", () => {
    expect(fuelFactor("diesel", factors)?.co2e).toBe(2.58354);
    expect(fuelFactor("HVO100", factors)?.co2e).toBe(0.03558);
    expect(fuelFactor("HVO50", factors)?.co2e).toBeCloseTo((2.58354 + 0.03558) / 2, 6);
    expect(fuelFactor("electric", factors)).toBeNull();
    expect(fuelFactor("HVO", { ...factors!, hvo: null })).toBeNull();
  });

  it("totals hours, idling, fuel, carbon and the HVO saving", () => {
    const s = summarisePlant(
      [asset("ex1", "diesel"), asset("ex2", "HVO"), asset("gen", "electric")],
      [
        { assetId: "ex1", operatingHours: 10, idleHours: 4, fuelLitres: 100, idleFuelLitres: null },
        { assetId: "ex2", operatingHours: 10, idleHours: 1, fuelLitres: 100, idleFuelLitres: null },
        { assetId: "gen", operatingHours: 5, idleHours: null, fuelLitres: null, idleFuelLitres: null },
      ],
      factors,
    );
    expect(s.totals).toMatchObject({ hours: 25, idleHours: 5, fuelLitres: 200, hvoLitres: 100, hvoShare: 0.5 });
    expect(s.totals.co2eKg).toBeCloseTo(258.354 + 3.558, 3);
    expect(s.totals.biogenicKg).toBeCloseTo(14 + 243, 3);
    expect(s.totals.hvoSavingKg).toBeCloseTo(100 * (2.58354 - 0.03558), 3);
    expect(s.assets.find((a) => a.asset.id === "ex1")?.idleShare).toBe(0.4);
    expect(s.assets.find((a) => a.asset.id === "gen")?.co2eKg).toBe(0);
  });

  it("flags sites where machines burnt more than was recorded", () => {
    const s = summarisePlant([asset("ex1", "diesel", "s1"), asset("ex2", "diesel", "s2")], [
      { assetId: "ex1", operatingHours: 10, idleHours: 0, fuelLitres: 500, idleFuelLitres: null },
      { assetId: "ex2", operatingHours: 10, idleHours: 0, fuelLitres: 100, idleFuelLitres: null },
    ], factors);
    const r = reconcileSites(s.assets, new Map([["s1", 400], ["s2", 300]]), new Map([["s1", "North"], ["s2", "South"]]));
    expect(r.map((x) => [x.siteName, x.gapLitres, x.gapShare])).toEqual([["North", 100, 0.25], ["South", -200, -2 / 3]]);
  });
});

describe("telematics ingest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("only matches and creates machines within the calling organisation", async () => {
    const { ingestTelematics } = await import("../ingest");
    db.plantAsset.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "a1", serialNumber: "SER-1" }]);
    db.plantAsset.createMany.mockResolvedValue({ count: 1 });
    db.plantTelematicsReading.createMany.mockResolvedValue({ count: 1 });
    const r = await ingestTelematics(
      "org-a",
      { kind: "rows", rows: [{ serialNumber: "SER-1", periodStart: new Date("2026-05-01"), periodEnd: new Date("2026-05-02"), fuelLitres: 50 }] },
      "csv",
      "u1",
    );
    expect(r).toMatchObject({ readingsCreated: 1, assetsRegistered: ["SER-1"] });
    for (const call of db.plantAsset.findMany.mock.calls) expect(call[0].where.organizationId).toBe("org-a");
    expect(db.plantAsset.createMany.mock.calls[0][0].data[0]).toMatchObject({ organizationId: "org-a", autoRegistered: true });
    expect(db.plantTelematicsReading.createMany.mock.calls[0][0]).toMatchObject({ skipDuplicates: true });
    expect(db.plantTelematicsReading.createMany.mock.calls[0][0].data[0]).toMatchObject({ organizationId: "org-a", assetId: "a1" });
  });

  it("refuses an API key from another organisation", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/integrations/plant/ingest/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST", body: JSON.stringify({ format: "rows", rows: [] }), headers: { authorization: "Bearer csk_x" } }),
      { params: Promise.resolve({ orgId: "org-b" }) },
    );
    expect(res.status).toBe(403);
    expect(db.plantTelematicsReading.createMany).not.toHaveBeenCalled();
  });
});
