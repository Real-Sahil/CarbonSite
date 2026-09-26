import type { CatalogueFramework, CatalogueRequirement } from "./types";
import data from "./generated/nist-sp-800-53-r5.json";

// Built from NIST's OSCAL catalogue by scripts/management-systems/build-oscal.ts;
// the source version and checksum are in the generated file.
export const nist80053: CatalogueFramework = {
  slug: "nist-sp-800-53-r5",
  name: "NIST SP 800-53 Security and privacy controls",
  shortName: "NIST 800-53",
  edition: `Rev. 5 (release ${data.source.version})`,
  publisher: "US National Institute of Standards and Technology (NIST)",
  family: "information_security",
  jurisdiction: "United States (used worldwide)",
  summary:
    "The US federal catalogue of security and privacy controls, grouped in 20 families, with Low, Moderate, High and Privacy baselines. Required for US federal systems and widely used as a control library elsewhere.",
  sourceUrl: "https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final",
  contentBasis: "official_text",
  contentNote:
    "Control statements copied from NIST's OSCAL catalogue (github.com/usnistgov/oscal-content); organisation-defined values are shown as [Assignment] and [Selection] as NIST prints them. Withdrawn controls are left out.",
  certifiable: false,
  tagLabels: { "baseline:low": "Low baseline", "baseline:moderate": "Moderate baseline", "baseline:high": "High baseline", "baseline:privacy": "Privacy baseline" },
  requirements: data.requirements as CatalogueRequirement[],
};
