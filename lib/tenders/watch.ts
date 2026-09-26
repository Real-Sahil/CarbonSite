/**
 * Tender watch: reads Find a Tender once for everyone, then records the
 * notices that match each organisation's watch as TenderOpportunity rows.
 * Run daily by the tenders monitor (migration 20260926000045) and on demand
 * from the Tenders page for one organisation.
 */
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { fetchTenderReleases, matchWatch, summariseRelease, tenderFlags, type NoticeSummary, type WatchCriteria } from "./fts";

/** How far back a first check (or a long gap) looks. */
export const MAX_LOOKBACK_DAYS = 7;

type WatchRow = { organizationId: string; cpvPrefixes: string[]; regions: string[]; keywords: string[]; minValue: Prisma.Decimal | null; lastCheckedAt: Date | null };

const criteria = (w: WatchRow): WatchCriteria => ({
  cpvPrefixes: w.cpvPrefixes,
  regions: w.regions,
  keywords: w.keywords,
  minValue: w.minValue == null ? null : Number(w.minValue),
});

/** Still open: a deadline in the future, or none given. */
const open = (n: NoticeSummary, now: Date) => n.stage === "tender" && (!n.deadline || n.deadline > now);

export type WatchRunResult = { checked: number; notices: number; added: number };

/**
 * Checks the enabled watches (one organisation's, when given). Idempotent: a
 * notice already recorded for an organisation is updated, never duplicated,
 * and its status is kept.
 */
export async function runTenderWatches(opts: { organizationId?: string; now?: Date } = {}): Promise<WatchRunResult> {
  const now = opts.now ?? new Date();
  const watches: WatchRow[] = await prisma.tenderWatch.findMany({
    where: { enabled: true, ...(opts.organizationId ? { organizationId: opts.organizationId } : {}) },
    select: { organizationId: true, cpvPrefixes: true, regions: true, keywords: true, minValue: true, lastCheckedAt: true },
  });
  if (!watches.length) return { checked: 0, notices: 0, added: 0 };

  const floor = new Date(now.getTime() - MAX_LOOKBACK_DAYS * 86_400_000);
  const from = watches.reduce((min, w) => {
    const since = w.lastCheckedAt && w.lastCheckedAt > floor ? w.lastCheckedAt : floor;
    return since < min ? since : min;
  }, now);

  let notices = 0;
  let added = 0;
  for await (const release of fetchTenderReleases(from, now)) {
    const n = summariseRelease(release);
    if (!open(n, now)) continue;
    notices++;
    for (const w of watches) {
      const matchedOn = matchWatch(n, criteria(w));
      if (!matchedOn) continue;
      const data = {
        ocid: n.ocid,
        title: n.title.slice(0, 500),
        buyerName: n.buyerName?.slice(0, 300) ?? null,
        buyerType: n.buyerType,
        valueAmount: n.value,
        currency: n.currency,
        cpvCodes: n.cpvCodes.slice(0, 50),
        regions: n.regions.slice(0, 50),
        deadline: n.deadline,
        publishedAt: n.publishedAt,
        matchedOn,
        flags: tenderFlags(n) as unknown as Prisma.InputJsonValue,
      };
      const existing = await prisma.tenderOpportunity.findUnique({
        where: { organizationId_noticeId: { organizationId: w.organizationId, noticeId: n.noticeId } },
        select: { id: true },
      });
      if (existing) {
        await prisma.tenderOpportunity.update({ where: { id: existing.id }, data });
      } else {
        await prisma.tenderOpportunity.create({ data: { ...data, organizationId: w.organizationId, noticeId: n.noticeId } });
        added++;
      }
    }
  }

  await prisma.tenderWatch.updateMany({
    where: { organizationId: { in: watches.map((w) => w.organizationId) } },
    data: { lastCheckedAt: now },
  });
  return { checked: watches.length, notices, added };
}
