import { describe, expect, it } from "vitest";
import { extractBill, parseUkDate } from "../bill-extractor";

const ELEC = `Octopus Energy Ltd
Invoice number: INV-2025-004812
Invoice date: 5 May 2025
Your electricity bill for the period 01/04/2025 - 30/04/2025
Meter reading previous 41,200 kWh present 43,050 kWh
Unit rate 24.50p/kWh
Units used 1,850 kWh
Standing charge 30 days at 53.2p
Same period last year 1,920 kWh`;

const GAS = `British Gas Business
Bill number: 88812345
Gas supply period 1 January 2025 to 31 March 2025
Previous reading 12,400 m3 Present reading 13,210 m3
Volume 810 m3 converted using calorific value 39.2
Total consumption 8,925 kWh
Unit rate 6.12p per kWh`;

const FUEL = `SHELL KNOTTINGLEY
Receipt no: 004417
Date 14/03/2025
DIESEL 64.37 L @ 142.9p
Total £91.98`;

describe("bill extractor", () => {
  it("takes the consumption line on an electricity bill, not the readings or last year", () => {
    const x = extractBill(ELEC);
    expect(x.kind).toBe("electricity");
    expect(x.categoryCode).toBe("s2-electricity-lb");
    expect(x.amount).toMatchObject({ value: 1850, confidence: 0.9 });
    expect(x.unit).toBe("kWh");
    expect(x.alternatives).toEqual(expect.arrayContaining([41200, 43050, 1920]));
    expect(x.supplier?.value).toBe("Octopus Energy");
    expect(x.invoiceNumber?.value).toBe("INV-2025-004812");
    expect(x.periodStart?.value).toBe("2025-04-01");
    expect(x.periodEnd?.value).toBe("2025-04-30");
    expect(x.issueDate?.value).toBe("2025-05-05");
  });

  it("prefers gas kWh over the metered volume", () => {
    const x = extractBill(GAS);
    expect(x.kind).toBe("gas");
    expect(x.categoryCode).toBe("s1-stationary");
    expect(x.amount?.value).toBe(8925);
    expect(x.unit).toBe("kWh");
    expect(x.supplier?.value).toBe("British Gas");
    expect(x.periodStart?.value).toBe("2025-01-01");
    expect(x.periodEnd?.value).toBe("2025-03-31");
  });

  it("reads litres and the fuel from a pump receipt", () => {
    const x = extractBill(FUEL);
    expect(x.kind).toBe("fuel");
    expect(x.categoryCode).toBe("s1-mobile");
    expect(x.amount?.value).toBe(64.37);
    expect(x.unit).toBe("litres");
    expect(x.fuelType?.value).toBe("diesel");
    expect(x.supplier?.value).toBe("Shell");
    expect(x.issueDate?.value).toBe("2025-03-14");
  });

  it("marks a guess among several quantities as low confidence", () => {
    const x = extractBill("Electricity statement\n1,200 kWh\n900 kWh\n300 kWh");
    expect(x.amount).toMatchObject({ value: 1200, confidence: 0.3 });
    expect(x.notes.join(" ")).toContain("Several quantities");
  });

  it("does not invent anything from an unrelated document", () => {
    const x = extractBill("Thank you for your order of 12 hard hats.");
    expect(x.kind).toBe("unknown");
    expect(x.amount).toBeNull();
    expect(x.categoryCode).toBeNull();
  });

  it("parses UK day-first dates and rejects impossible ones", () => {
    expect(parseUkDate("03/04/2025")).toBe("2025-04-03");
    expect(parseUkDate("3rd Sept 2025")).toBe("2025-09-03");
    expect(parseUkDate("31/02/2025")).toBeNull();
    expect(parseUkDate("2025-12-31")).toBe("2025-12-31");
  });
});
