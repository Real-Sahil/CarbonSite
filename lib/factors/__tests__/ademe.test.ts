// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildAdemeFactors, buildAdemeMigrationSql, nafFromComment } from "../ademe";

const COLS = [
  "Type Ligne", "Identifiant de l'élément", "Type de l'élément", "Statut de l'élément", "Nom base français", "Nom base anglais",
  "Nom attribut français", "Nom attribut anglais", "Nom frontière français", "Nom frontière anglais", "Code de la catégorie",
  "Unité français", "Localisation géographique", "Date de modification", "Période de validité", "Commentaire français",
  "Type poste", "Nom poste français", "Total poste non décomposé", "CO2b",
];
type R = Partial<Record<(typeof COLS)[number], string>>;
const el = (r: R): R => ({ "Type Ligne": "Elément", "Type de l'élément": "Facteur d'émission", "Statut de l'élément": "Valide générique", "Localisation géographique": "France continentale", "Date de modification": "2025-04-24", ...r });
const poste = (id: string, type: string, total: string, co2b = ""): R => ({ "Type Ligne": "Poste", "Identifiant de l'élément": id, "Type poste": type, "Total poste non décomposé": total, CO2b: co2b });
const csv = (rows: R[]) => [COLS, ...rows.map((r) => COLS.map((c) => r[c] ?? ""))].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");

const FILE = csv([
  el({ "Identifiant de l'élément": "1", "Nom base français": "Electricité", "Nom attribut français": "2023 - mix moyen", "Nom frontière français": "consommation", "Code de la catégorie": "Electricité > Mix réseau électrique > France", "Unité français": "kgCO2e/kWh", "Total poste non décomposé": "0.058" }),
  poste("1", "Combustion à la centrale", "0.0394"), poste("1", "Amont", "0.01"), poste("1", "Transport et distribution", "0.0086"),
  el({ "Identifiant de l'élément": "2", "Nom base français": "Electricité", "Nom attribut français": "2024 - mix moyen", "Nom frontière français": "consommation", "Code de la catégorie": "Electricité > Mix réseau électrique > France", "Unité français": "kgCO2e/kWh", "Total poste non décomposé": "0.05" }),
  poste("2", "Combustion à la centrale", "0.035"),
  el({ "Identifiant de l'élément": "3", "Nom base français": "Gazole routier", "Nom base anglais": "Road diesel", "Code de la catégorie": "Combustibles > Fossiles > Liquides", "Unité français": "kgCO2e/litre", "Total poste non décomposé": "3.1" }),
  poste("3", "Combustion", "2.5", "0.13"), poste("3", "Amont", "0.6"),
  el({ "Identifiant de l'élément": "4", "Nom base français": "Gaz naturel", "Code de la catégorie": "Combustibles > Fossiles > Gazeux", "Unité français": "kgCO2e/kWh PCI", "Total poste non décomposé": "0.243" }),
  el({ "Identifiant de l'élément": "5", "Nom base français": "Agences de voyage – 2023", "Code de la catégorie": "Achats de services > Ratios monétaires", "Unité français": "kgCO2e/keuro (2023) HT", "Total poste non décomposé": "164", "Commentaire français": "NAF-N79 - Agences" }),
  el({ "Identifiant de l'élément": "6", "Nom base français": "Agences de voyage – 2022", "Code de la catégorie": "Achats de services > Ratios monétaires", "Unité français": "kgCO2e/keuro (2022) HT", "Total poste non décomposé": "170", "Commentaire français": "NAF-N79 - Agences" }),
  el({ "Identifiant de l'élément": "7", "Nom base français": "Autocar", "Code de la catégorie": "Transport de personnes > Routier", "Unité français": "kgCO2e/passager.km", "Total poste non décomposé": "0.04" }),
  poste("7", "Fabrication", "0.005"), poste("7", "Combustion", "0.03"),
  el({ "Identifiant de l'élément": "8", "Statut de l'élément": "Archivé", "Nom base français": "Old", "Code de la catégorie": "Achats de biens > X", "Unité français": "kgCO2e/kg", "Total poste non décomposé": "1" }),
  el({ "Identifiant de l'élément": "9", "Nom base français": "HFC-134a", "Code de la catégorie": "Process et émissions fugitives > PRG à 100 ans issus du 6eme rapport du GIEC", "Unité français": "kgCO2e/kg", "Localisation géographique": "Monde", "Total poste non décomposé": "1530" }),
]);

describe("ADEME Base Carbone import", () => {
  const b = buildAdemeFactors(FILE);
  const byId = (id: string) => b.factors.find((f) => f.externalId === id)!;

  it("takes power-station combustion for Scope 2, one effective year each, the latest open", () => {
    expect(byId("ademe-1")).toMatchObject({ categoryCode: "s2-electricity-lb", co2e: 0.0394, effectiveStart: "2023-01-01", effectiveEnd: "2023-12-31", geographyCountry: "FR" });
    expect(byId("ademe-2")).toMatchObject({ effectiveStart: "2024-01-01", effectiveEnd: null });
  });

  it("takes fuel combustion only, in stationary and (per litre) mobile, and skips net-CV energy units", () => {
    expect(byId("ademe-3")).toMatchObject({ categoryCode: "s1-stationary", inputUnit: "litre", co2e: 2.5, biogenicCo2: 0.13 });
    expect(byId("ademe-3-mobile").categoryCode).toBe("s1-mobile");
    expect(b.factors.some((f) => f.externalId === "ademe-4")).toBe(false);
    expect(b.skipped["fuel: net CV (PCI), GJ, MJ or tep unit"]).toBe(1);
  });

  it("keeps the latest spend year per EUR, with its price year and NAF division", () => {
    expect(b.spendYear).toBe(2023);
    expect(byId("ademe-5")).toMatchObject({ inputUnit: "EUR", co2e: 0.164, priceBaseYear: 2023, activityType: "naf_79" });
    expect(b.skipped["spend: earlier year (2022)"]).toBe(1);
    expect(nafFromComment("NAF-C10-C12 - Food")).toBe("10");
  });

  it("leaves vehicle manufacture out of transport, keeps AR6 GWPs, and drops archived rows", () => {
    expect(byId("ademe-7").co2e).toBeCloseTo(0.035, 10);
    expect(byId("ademe-9")).toMatchObject({ categoryCode: "s1-fugitive", co2e: 1530, geographyCountry: null });
    expect(b.skipped["status Archivé"]).toBe(1);
  });

  it("refuses a file that is not a Base Carbone export", () => {
    expect(() => buildAdemeFactors('"a","b"\n"1","2"')).toThrow(/missing column/);
  });

  it("writes an additive migration that lists what was left out", () => {
    const sql = buildAdemeMigrationSql(b, "f.csv");
    expect(sql).toContain("VALUES (gen_random_uuid()::text, 'ADEME Base Carbone', '2025.04', 'Licence Ouverte v2.0 (Etalab)'");
    expect(sql).toMatch(/--\s+1 status Archivé/);
    expect(sql).toContain("WHERE NOT EXISTS");
    expect(sql).toContain("DATE '2024-01-01', NULL::date");
  });
});
