import type { CatalogueFramework, CatalogueRequirement } from "./types";
import { iso9001 } from "./iso-9001-2015";
import { iso9001_2026 } from "./iso-9001-2026";
import { iso14001 } from "./iso-14001-2015";
import { iso14001_2026 } from "./iso-14001-2026";
import { iso45001 } from "./iso-45001-2018";
import { nist80053 } from "./nist-sp-800-53-r5";
import { nistCsf2 } from "./nist-csf-2-0";
import { iso27001 } from "./iso-27001-2022";
import { iso42001 } from "./iso-42001-2023";
import { euGdpr, ukGdpr } from "./gdpr";
import { hipaa } from "./hipaa";
import { ccpa, nis2, pipeda } from "./privacy-other";
import { cyberEssentials, pciDss, soc2 } from "./security-other";

export type { CatalogueFramework, CatalogueRequirement, EditionChange, FrameworkFamily } from "./types";
export { transitionMap } from "./revise";

/** Every framework an organisation can adopt, in display order. */
export const FRAMEWORKS: CatalogueFramework[] = [
  iso14001_2026,
  iso14001,
  iso45001,
  iso9001_2026,
  iso9001,
  ukGdpr,
  euGdpr,
  ccpa,
  pipeda,
  iso27001,
  soc2,
  cyberEssentials,
  nistCsf2,
  nist80053,
  nis2,
  pciDss,
  hipaa,
  iso42001,
];

const BY_SLUG = new Map(FRAMEWORKS.map((f) => [f.slug, f]));

/** The newer edition that replaces this framework, if there is one in the catalogue. */
export function successorOf(slug: string): CatalogueFramework | null {
  return FRAMEWORKS.find((f) => f.supersedes === slug) ?? null;
}

export function getFramework(slug: string): CatalogueFramework | null {
  return BY_SLUG.get(slug) ?? null;
}

export function getRequirement(slug: string, code: string): CatalogueRequirement | null {
  return getFramework(slug)?.requirements.find((r) => r.code === code) ?? null;
}

/** Codes that have children: headings, not assessed on their own. */
export function headingCodes(framework: CatalogueFramework): Set<string> {
  return new Set(framework.requirements.flatMap((r) => (r.parent ? [r.parent] : [])));
}

/** The requirements an organisation assesses: every one that is not a heading. */
export function assessableRequirements(framework: CatalogueFramework): CatalogueRequirement[] {
  const headings = headingCodes(framework);
  return framework.requirements.filter((r) => !headings.has(r.code));
}

/**
 * Requirements in other frameworks that ask for the same thing, so a
 * framework page can say "also covers ISO 45001 9.2".
 */
export function sharedRequirements(slug: string, code: string): Array<{ framework: CatalogueFramework; requirement: CatalogueRequirement }> {
  const req = getRequirement(slug, code);
  if (!req?.sharedKey) return [];
  return FRAMEWORKS.flatMap((framework) =>
    framework.slug === slug
      ? []
      : framework.requirements
          .filter((r) => r.sharedKey === req.sharedKey)
          .map((requirement) => ({ framework, requirement })),
  );
}

/**
 * A short fingerprint of what MetricOra says about a framework (codes, titles,
 * guidance, links). A guidance review signed off against one fingerprint is
 * shown as out of date once the catalogue changes. Pure, so it runs anywhere.
 */
export function catalogueFingerprint(framework: CatalogueFramework): string {
  const text = JSON.stringify(framework.requirements.map((r) => [r.code, r.title, r.guidance ?? "", r.officialText ?? "", r.url ?? ""]));
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
  }
  return `${framework.edition}#${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}
