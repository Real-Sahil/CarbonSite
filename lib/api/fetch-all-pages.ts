// Client side: reads every page of an offset-paged list into one array, for pickers that cannot
// show a partial list. Stops at the reported total, a short page, or the offset ceiling the server
// enforces. Throws on a failed page so the caller's catch decides what the picker shows.
import { MAX_OFFSET, MAX_PAGE_SIZE } from "@/lib/api/pagination";

type OffsetPage<T> = { data: T[]; pagination: { offset: number; limit: number; total: number } };

export async function fetchAllPages<T>(url: string): Promise<T[]> {
  const separator = url.includes("?") ? "&" : "?";
  const rows: T[] = [];
  for (let offset = 0; offset <= MAX_OFFSET; offset += MAX_PAGE_SIZE) {
    const res = await fetch(`${url}${separator}limit=${MAX_PAGE_SIZE}&offset=${offset}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} reading ${url}`);
    const body = (await res.json()) as OffsetPage<T>;
    rows.push(...body.data);
    if (body.data.length < MAX_PAGE_SIZE || rows.length >= body.pagination.total) break;
  }
  return rows;
}
