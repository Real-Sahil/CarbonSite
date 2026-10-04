// The library records and migration notes for the four national factor loads.
// Names matter: lib/calculation/library-country.ts reads the country from them.

import type { NationalLibrary } from "./national-load";

export type NationalSource = { library: NationalLibrary; comments: string[]; file: string };

export const NATIONAL_SOURCES: Record<"nga" | "eccc" | "uba" | "seai", NationalSource> = {
  nga: {
    file: "national-greenhouse-account-factors-2025.xlsx",
    library: {
      name: "NGA Factors",
      version: "2025",
      license: "Creative Commons Attribution (Commonwealth of Australia, DCCEEW)",
      sourceUrl: "https://www.dcceew.gov.au/climate-change/publications/national-greenhouse-accounts-factors-2025",
      publishedAt: "2025-01-01",
    },
    comments: [
      "Australian National Greenhouse Accounts Factors 2025 (DCCEEW). Gases are combined by NGA at IPCC AR5 GWPs.",
      "State and grid electricity rows (activity type grid_au_<code>) are chosen only when the record or its facility names the state; otherwise the national row applies.",
    ],
  },
  eccc: {
    file: "EN_Annex7_Electricity_Intensity.xlsx",
    library: {
      name: "ECCC",
      version: "2024",
      license: "Open Government Licence - Canada",
      sourceUrl: "https://open.canada.ca/data/en/dataset/779c7bcf-4982-47eb-af1b-a33618a05e5b",
      publishedAt: "2026-04-14",
    },
    comments: [
      "Canada's National Inventory Report 1990-2024, Annex 7: electricity consumption intensity by province and territory. Electricity only; a run on this library prices every other record from DEFRA (library fallback).",
      "Province rows (activity type grid_ca_<code>) are chosen only when the record or its facility names the province; otherwise the national row applies. The latest year is preliminary.",
    ],
  },
  uba: {
    file: "uba-liste-ef-thg-bilanzierung-v2.1.xlsx",
    library: {
      name: "UBA",
      version: "2.1",
      license: "CC0 1.0 (Umweltbundesamt)",
      sourceUrl: "https://www.umweltbundesamt.de/themen/wirtschaft-konsum/wirtschaft-umwelt/umwelt-energiemanagement/emissionsfaktoren-zur-treibhausgasbilanzierung-von",
      publishedAt: "2026-03-01",
    },
    comments: [
      "Umweltbundesamt list of emission factors for the greenhouse gas accounting of organisations, version 2.1 (March 2026), CC0 1.0. UBA asks that the source is named and changes are marked: the rows were restructured into MetricOra's categories and canonical units, values unchanged.",
      "kWh rows are lower heating value (kWh_ncv) except natural gas by Brennwert, which is gross kWh.",
    ],
  },
  seai: {
    file: "SEAI-conversion-and-emission-factors.xlsx",
    library: {
      name: "SEAI",
      version: "2025",
      license: "SEAI, Conversion and emission factors; no licence stated in the workbook (source cited on every factor)",
      sourceUrl: "https://www.seai.ie/data-and-insights/seai-statistics/conversion-factors",
      publishedAt: "2026-01-01",
    },
    comments: [
      "SEAI conversion and emission factors, 2025 values. CO2 only: SEAI gives no CH4 or N2O. Fuels are on a net calorific value basis unless the row says GCV.",
    ],
  },
};
