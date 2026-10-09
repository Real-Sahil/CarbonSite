// Cached reads of shared reference data: emission categories and factor libraries. Both are the same for every
// organisation (categories are seeded, libraries are loaded by platform staff and migrations), so one entry serves
// everyone. Nothing organisation-owned belongs here: a cache key without an organisation id must never hold one
// organisation's rows (`lib/cache/__tests__/reference.test.ts`).
//
// Entries are keyed by deploy, so a release that adds a library or category starts from a fresh read, and they
// expire on a timer as well. `revalidateTag(REF_TAGS.libraries, "max")` clears them on demand.

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

export const REF_TAGS = { categories: "ref-categories", libraries: "ref-factor-libraries" } as const;

const DEPLOY = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";

// unstable_cache needs the Next.js runtime. Tests, scripts and background workers have none and get a direct read.
async function cached<T>(key: string, tag: string, seconds: number, load: () => Promise<T>): Promise<T> {
  try {
    return await unstable_cache(load, [key, DEPLOY], { tags: [tag], revalidate: seconds })();
  } catch (err) {
    if (err instanceof Error && /incrementalCache|static generation store/i.test(err.message)) return load();
    throw err;
  }
}

export type CachedCategory = { id: string; scope: number; code: string; name: string };
export type CachedLibrary = { id: string; name: string; version: string };

/** Every emission category, scope then name. An hour: categories change only with a release. */
export function getEmissionCategories(): Promise<CachedCategory[]> {
  return cached("emission-categories", REF_TAGS.categories, 3600, () =>
    prisma.emissionCategory.findMany({
      select: { id: true, scope: true, code: true, name: true },
      orderBy: [{ scope: "asc" }, { name: "asc" }],
    }),
  );
}

/** Every factor library, newest published first. Five minutes: a library added by a migration shows up soon after. */
export function getFactorLibraries(): Promise<CachedLibrary[]> {
  return cached("factor-libraries", REF_TAGS.libraries, 300, () =>
    prisma.factorLibrary.findMany({
      select: { id: true, name: true, version: true },
      orderBy: { publishedAt: "desc" },
    }),
  );
}
