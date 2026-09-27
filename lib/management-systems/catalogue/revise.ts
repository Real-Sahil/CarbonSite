import type { CatalogueFramework, CatalogueRequirement, EditionChange } from "./types";

// Builds a new edition of a standard from the previous one: requirements the
// revision left alone carry over unchanged (and are mapped from the same
// code), the rest are replaced, added or removed as listed. Used for ISO
// 14001:2026 and ISO 9001:2026, whose revisions kept most clauses.

type Revision = {
  base: CatalogueFramework;
  meta: Omit<CatalogueFramework, "requirements" | "supersedes" | "family" | "publisher" | "certifiable" | "contentBasis"> &
    Partial<Pick<CatalogueFramework, "family" | "publisher" | "certifiable" | "contentBasis">>;
  /** Codes of the base edition that no longer exist (their content moved; say where in `editionChange.from`). */
  remove?: string[];
  /** Replacement or new requirements, keyed by code. A code not in the base is inserted after `after`. */
  set?: Array<CatalogueRequirement & { after?: string }>;
};

export function revise({ base, meta, remove = [], set = [] }: Revision): CatalogueFramework {
  const removed = new Set(remove);
  const byCode = new Map(set.map((r) => [r.code, r]));
  const out: CatalogueRequirement[] = [];
  const placed = new Set<string>();
  const clean = ({ after: _after, ...r }: CatalogueRequirement & { after?: string }): CatalogueRequirement => r;
  const insertAfter = (code: string) => {
    for (const r of set) if (r.after === code && !placed.has(r.code)) {
      out.push(clean(r));
      placed.add(r.code);
      insertAfter(r.code);
    }
  };
  for (const r of base.requirements) {
    if (!removed.has(r.code)) {
      const next = byCode.get(r.code);
      if (next) {
        out.push(clean(next));
        placed.add(r.code);
      } else {
        out.push(r);
      }
    }
    insertAfter(r.code);
  }
  const missing = set.filter((r) => !placed.has(r.code)).map((r) => r.code);
  if (missing.length) throw new Error(`revise(${meta.slug}): could not place ${missing.join(", ")}`);
  return {
    family: base.family,
    publisher: base.publisher,
    certifiable: base.certifiable,
    contentBasis: base.contentBasis,
    ...meta,
    supersedes: base.slug,
    requirements: out,
  };
}

/**
 * Where each requirement of `framework` carries on from in the edition it
 * supersedes: an unchanged requirement from the same code, a revised one from
 * its `editionChange.from` (or the same code when that existed), a new one
 * from nothing.
 */
export function transitionMap(framework: CatalogueFramework, previous: CatalogueFramework): Map<string, { from: string[]; change?: EditionChange }> {
  const old = new Set(previous.requirements.map((r) => r.code));
  const map = new Map<string, { from: string[]; change?: EditionChange }>();
  for (const r of framework.requirements) {
    const change = r.editionChange;
    const from = change?.from ?? (change?.kind === "new" ? [] : old.has(r.code) ? [r.code] : []);
    map.set(r.code, { from, change });
  }
  return map;
}
