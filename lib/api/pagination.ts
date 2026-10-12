// Shared paging for list endpoints and list pages. Any list that can grow without bound reads its
// page through here. A missing or malformed value falls back to the default instead of reaching
// Prisma as NaN (which fails the whole request), and a value above the maximum is clamped, never
// honoured. Pure: no database or request imports, so it runs in routes, server pages and tests.

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;
/** Deep offset pages get slow; cursor pagination is the answer past this point. */
export const MAX_OFFSET = 100_000;

/** A whole, non-negative number from a query value, clamped to [min, max]; anything else gives the fallback. */
export function wholeNumberParam(raw: string | null | undefined, fallback: number, min: number, max: number): number {
  if (raw == null) return fallback;
  const trimmed = raw.trim();
  if (!/^\d{1,9}$/.test(trimmed)) return fallback;
  return Math.min(max, Math.max(min, Number(trimmed)));
}

/** Limit and offset from a query string, for offset-paged lists. */
export function offsetPage(
  params: URLSearchParams,
  opts: { defaultLimit?: number; maxLimit?: number } = {},
): { limit: number; offset: number } {
  const limit = wholeNumberParam(params.get("limit"), opts.defaultLimit ?? DEFAULT_PAGE_SIZE, 1, opts.maxLimit ?? MAX_PAGE_SIZE);
  const offset = wholeNumberParam(params.get("offset"), 0, 0, MAX_OFFSET);
  return { limit, offset };
}

/**
 * Trims a result fetched with `take: limit + 1` into one page. The cursor is the last row
 * returned, so the next page starts after it and no row is skipped.
 */
export function cursorPage<T extends { id: string }>(rows: T[], limit: number): { items: T[]; hasMore: boolean; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, hasMore, nextCursor: hasMore ? items[items.length - 1].id : null };
}

/** Query string for a page link, with every value encoded and empty values dropped. */
export function pageHref(base: string, values: Record<string, string | number | undefined | null>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    qs.set(key, String(value));
  }
  const text = qs.toString();
  return text ? `${base}?${text}` : base;
}
