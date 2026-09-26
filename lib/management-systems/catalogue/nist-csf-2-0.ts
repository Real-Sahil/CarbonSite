import type { CatalogueFramework, CatalogueRequirement } from "./types";
import data from "./generated/nist-csf-2-0.json";

// Built from NIST's OSCAL catalogue by scripts/management-systems/build-oscal.ts.
export const nistCsf2: CatalogueFramework = {
  slug: "nist-csf-2-0",
  name: "NIST Cybersecurity Framework",
  shortName: "NIST CSF 2.0",
  edition: "2.0",
  publisher: "US National Institute of Standards and Technology (NIST)",
  family: "cyber",
  summary:
    "Outcomes for managing cybersecurity risk in six functions: Govern, Identify, Protect, Detect, Respond and Recover. Voluntary, sector-neutral and widely used to structure a security programme.",
  sourceUrl: "https://www.nist.gov/cyberframework",
  contentBasis: "official_text",
  contentNote:
    "Outcome statements and implementation examples copied from NIST's OSCAL catalogue (github.com/usnistgov/oscal-content).",
  certifiable: false,
  requirements: data.requirements as CatalogueRequirement[],
};
