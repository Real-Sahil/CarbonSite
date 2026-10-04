// What MetricOra recommends for an organisation, from its HQ country. This is a
// nudge, never a lock: plan and role still decide what a person may do, and any
// report, library or tool stays reachable from any country. A profile only
// decides which reports lead the picker, which national factor library the
// settings page mentions, and what the product honestly has loaded for that
// country, so a German or Emirati customer is not led through UK forms.

import { countryIso2 } from "@/lib/calculation/geography";
import { regionOf } from "@/lib/compliance/regions";

export type ProfileRegion = "uk" | "eu" | "uae" | "us" | "other";

export type CountryProfile = {
  /** ISO 3166-1 alpha-2, or null when the country is unset or not recognised. */
  iso2: string | null;
  region: ProfileRegion;
  /** Report types to lead the picker with, best first. Ids match the report registry. */
  recommendedReports: string[];
  /** The country a national factor library is written for, when one is loaded. */
  nationalLibraryCountry: string | null;
  /** Plain statements of what is and is not loaded for this country. */
  notes: string[];
};

// National activity libraries loaded in the repo (see libraryCountry()).
const NATIONAL_LIBRARY = new Set(["GB", "US", "FR", "AU", "CA", "DE", "IE"]);

const UK = ["ghg_protocol", "ppn_006_crp", "secr", "bid_carbon_pack"];
const EU = ["ghg_protocol", "csrd_esrs_e1", "csrd_esrs_e3", "csrd_esrs_e5", "sustainability_report"];
const UAE = ["ghg_protocol", "tcfd_statement", "cdp", "sustainability_report"];
const US = ["ghg_protocol", "cdp", "tcfd_statement", "sustainability_report"];
const OTHER = ["ghg_protocol", "cdp", "tcfd_statement", "sustainability_report"];

export function countryProfile(country: string | null | undefined): CountryProfile {
  const iso2 = countryIso2(country);
  const found = regionOf(iso2);
  // Australia and Canada have calendar entries but no report list of their own yet.
  const regional = found === "au" || found === "ca" || found === "de" ? null : found;
  const region: ProfileRegion = regional ?? (iso2 === "US" ? "us" : "other");
  const nationalLibraryCountry = iso2 && NATIONAL_LIBRARY.has(iso2) ? iso2 : null;

  const notes: string[] = [];
  if (!iso2) {
    notes.push("No country set, so UK defaults apply. Choose the HQ country to get the right library and reports first.");
  }
  if (region === "uk") {
    notes.push("DEFRA factors and the UK report forms (PPN 006, SECR, bid pack) are loaded.");
  } else if (region === "eu") {
    notes.push("The CSRD ESRS E1, E3 and E5 reports are loaded. Whether CSRD applies depends on your size and group.");
    notes.push(
      iso2 === "FR"
        ? "ADEME Base Carbone is loaded for France."
        : iso2 === "DE"
          ? "The UBA emission factor list (version 2.1, CC0) is loaded for Germany: fuels, German electricity mix, travel, freight and refrigerants. The calendar lists the BEHG fuel emissions report; Germany's CSRD transposition law was still before the Bundestag at the last check, so follow the EU dates."
          : iso2 === "IE"
            ? "SEAI's Irish emission factors (2025) are loaded: fuels and electricity by year. They are CO2 only, and other records fall back to the DEFRA set. Ireland transposed the CSRD in July 2024; the calendar shows the EU dates."
            : "ADEME electricity factors cover your country's grid; other national factors fall back to the DEFRA set.",
    );
  } else if (region === "uae") {
    notes.push("The Abu Dhabi MRV facility workbook is under Compliance. Other emirates and federal reporting are not loaded.");
  } else if (region === "us") {
    notes.push("EPA factors are loaded: fuels, travel, waste, refrigerants and eGRID grid rates (set a site's eGRID subregion in Settings for regional electricity, and add a residual mix rate under Electricity contracts for market-based Scope 2).");
    notes.push("California SB 253 (Scope 1 and 2, then Scope 3) is served by the GHG Protocol report and its assurance pack; SB 261 (climate-related financial risk) by the climate disclosure, which follows the TCFD structure. Both are on the regulatory calendar. No report in the CARB template is built, as CARB has not published its final one.");
    notes.push("The SEC climate disclosure rules are stayed and the SEC proposed in May 2026 to rescind them, so no SEC report is built. EPA's Greenhouse Gas Reporting Program is facility-level reporting to EPA and is under reconsideration, so it is not built either.");
  } else if (iso2) {
    notes.push(
      iso2 === "AU" || iso2 === "CA"
        ? "The regulatory calendar lists this country's emissions reporting dates. GHG Protocol, CDP and TCFD-structure reports work anywhere."
        : "No national regulatory rules are loaded for this country. GHG Protocol, CDP and TCFD-structure reports work anywhere.",
    );
    if (iso2 === "AU") {
      notes.push("The NGA Factors 2025 are loaded: state and grid electricity (set each facility's state in Settings, otherwise the national average is used), fuels, landfill waste and refrigerants.");
    } else if (iso2 === "CA") {
      notes.push("Environment and Climate Change Canada's electricity intensity by province is loaded (set each facility's province in Settings, otherwise the national figure is used); other records fall back to the DEFRA set.");
    }
  }
  if (iso2 && !nationalLibraryCountry && region !== "eu") {
    notes.push("No national factor library is loaded, so records use the DEFRA set unless you add your own factors.");
  }

  const recommendedReports =
    region === "uk" || !iso2 ? UK : region === "eu" ? EU : region === "uae" ? UAE : region === "us" ? US : OTHER;
  return { iso2, region, recommendedReports, nationalLibraryCountry, notes };
}
