import { describe, expect, it } from "vitest";
import { summariseMachines, summariseSites, summariseStores, type StoreIn } from "../rollup";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const store: StoreIn = { id: "s1", name: "Bowser 1", kind: "bowser", fuelType: "diesel", capacityLitres: 5000, siteId: "site1", siteName: "Northgate", ownership: "owned", active: true };
const from = d("2026-09-01");
const to = d("2026-10-01");

describe("summariseStores", () => {
  it("balances: baseline dip + deliveries - issues = last dip, no flag", () => {
    const [s] = summariseStores(
      [store],
      [{ storeId: "s1", on: d("2026-09-10"), fuelType: "diesel", litres: 3000 }, { storeId: "s1", on: d("2026-09-20"), fuelType: "hvo", litres: 1000 }],
      [{ storeId: "s1", on: d("2026-09-12"), litres: 1500, plantAssetId: "a1", vehicleLabel: null }],
      [{ storeId: "s1", on: d("2026-08-31"), litres: 500 }, { storeId: "s1", on: d("2026-09-30"), litres: 3000 }],
      from, to,
    );
    expect(s.inByType).toEqual({ diesel: 3000, hvo: 1000 });
    expect(s.litresOut).toBe(1500);
    expect(s.expected).toBe(3000);
    expect(s.variance).toBe(0);
    expect(s.flagged).toBe(false);
  });

  it("flags missing fuel above the share and floor, negative variance", () => {
    const [s] = summariseStores(
      [store],
      [],
      [{ storeId: "s1", on: d("2026-09-05"), litres: 1000, plantAssetId: null, vehicleLabel: "Van" }],
      [{ storeId: "s1", on: d("2026-09-01"), litres: 2000 }, { storeId: "s1", on: d("2026-09-30"), litres: 900 }],
      from, to,
    );
    expect(s.variance).toBe(-100);
    expect(s.flagged).toBe(true);
  });

  it("small drift under the floor is not flagged; one dip gives no variance", () => {
    const small = summariseStores([store], [], [], [{ storeId: "s1", on: d("2026-09-01"), litres: 1000 }, { storeId: "s1", on: d("2026-09-30"), litres: 990 }], from, to)[0];
    expect(small.variance).toBe(-10);
    expect(small.flagged).toBe(false);
    const one = summariseStores([store], [], [], [{ storeId: "s1", on: d("2026-09-15"), litres: 1000 }], from, to)[0];
    expect(one.variance).toBeNull();
    expect(one.lastDip?.litres).toBe(1000);
  });

  it("ignores movements outside the month and flags a dip over capacity", () => {
    const s = summariseStores(
      [store],
      [{ storeId: "s1", on: d("2026-10-02"), fuelType: "diesel", litres: 9999 }],
      [],
      [{ storeId: "s1", on: d("2026-09-30"), litres: 6000 }],
      from, to,
    )[0];
    expect(s.litresIn).toBe(0);
    expect(s.overCapacity).toBe(true);
  });
});

describe("summariseMachines", () => {
  it("joins issues to telematics and groups free-text vehicles", () => {
    const rows = summariseMachines(
      [{ id: "a1", name: "CAT 320" }, { id: "a2", name: "Dumper" }],
      [
        { storeId: "s1", on: d("2026-09-02"), litres: 200, plantAssetId: "a1", vehicleLabel: null },
        { storeId: "s1", on: d("2026-09-03"), litres: 50, plantAssetId: null, vehicleLabel: "Hired van" },
        { storeId: "s1", on: d("2026-09-04"), litres: 25, plantAssetId: null, vehicleLabel: "hired van " },
      ],
      new Map([["a1", { litres: 180, hours: 20, idleHours: 5 }], ["a2", { litres: 0, hours: 0, idleHours: 0 }]]),
    );
    expect(rows[0]).toMatchObject({ label: "CAT 320", issued: 200, telematicsLitres: 180, hours: 20, idleShare: 0.25 });
    expect(rows.find((r) => r.label.toLowerCase().startsWith("hired van"))?.issued).toBe(75);
    expect(rows.some((r) => r.label === "Dumper")).toBe(false);
  });
});

describe("summariseSites", () => {
  it("compares delivered litres with recorded litres per site", () => {
    const stores = summariseStores([store], [{ storeId: "s1", on: d("2026-09-10"), fuelType: "diesel", litres: 4000 }], [], [], from, to);
    const rows = summariseSites(stores, new Map([["site1", 3500]]));
    expect(rows[0]).toMatchObject({ siteName: "Northgate", delivered: 4000, recorded: 3500, gap: 500 });
  });
});
