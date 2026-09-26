// Catalogue of management system standards, privacy laws and security
// frameworks an organisation can work towards.
//
// Content rules (see CLAUDE.md, "Management systems"):
// - Copyrighted standards (ISO, SOC 2, PCI DSS, NEN) carry only clause
//   references, MetricOra's own short titles and MetricOra's own guidance. The
//   text of the standard is never reproduced; the organisation works from its
//   own licensed copy.
// - Laws and public-domain frameworks (GDPR, UK GDPR, HIPAA, CCPA, PIPEDA,
//   NIS2, NIST) may carry `officialText`, but only when a build script copied
//   it from the official source named in `sourceUrl`. Never typed by hand.

import type { SignalKey } from "../signal-keys";

export type FrameworkFamily =
  | "management_system"
  | "privacy"
  | "information_security"
  | "cyber"
  | "healthcare"
  | "payments"
  | "ai";

export type ContentBasis =
  /** Clause references with MetricOra's own titles and guidance. */
  | "references"
  /** Requirement text copied by a build script from the official source. */
  | "official_text";

export type CatalogueRequirement = {
  /** The standard's own reference, e.g. "6.1.2" or "Art. 30". Unique in the framework. */
  code: string;
  title: string;
  /** What the requirement asks for and what an auditor will look for, in MetricOra's words. */
  guidance?: string;
  /** Code of the parent heading. A requirement with children is a heading, not assessed on its own. */
  parent?: string;
  /** Kinds of evidence that usually satisfy it. */
  evidenceHints?: string[];
  /** Live figures from the organisation's own records shown beside the requirement. */
  signals?: SignalKey[];
  /**
   * Requirements in different frameworks that ask for the same thing share a
   * key (e.g. "hls:9.2" for internal audit in every ISO management system
   * standard), so work on one can be shown against the others.
   */
  sharedKey?: string;
  /** Official wording, only when copied by a build script (contentBasis "official_text"). */
  officialText?: string;
  /** Examples published by the source itself (e.g. NIST CSF implementation examples), copied by the build script. */
  examples?: string[];
  /** Link to the official text of this requirement, for laws published online. */
  url?: string;
  /** Filters the framework defines, e.g. "baseline:moderate" for NIST SP 800-53. Keys of `tagLabels`. */
  tags?: string[];
};

export type CatalogueFramework = {
  /** Stable id including the edition, e.g. "iso-14001-2015". Stored on organisation rows. */
  slug: string;
  name: string;
  shortName: string;
  /** Edition and amendments covered, e.g. "2015 with Amd 1:2024". */
  edition: string;
  publisher: string;
  family: FrameworkFamily;
  jurisdiction?: string;
  summary: string;
  sourceUrl: string;
  contentBasis: ContentBasis;
  /** Shown on the framework page: how this catalogue was produced. */
  contentNote: string;
  /** Can a certification body certify against it? Shows certificate fields when true. */
  certifiable: boolean;
  /** Labels for the requirement tags this framework uses, in display order. */
  tagLabels?: Record<string, string>;
  requirements: CatalogueRequirement[];
};
