/**
 * Tender watch: reads Find a Tender once for everyone, then records the
 * notices that match each organisation's watch as TenderOpportunity rows.
 * Run daily by the tenders monitor (migration 20260926000045) and on demand
 * from the Tenders page for one organisation.
 */
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { fetchTenderReleases, matchWatch, summariseRelease, tenderFlags, type NoticeSummary, type OcdsRelease, type WatchCriteria } from "./fts";

/** How far back a first check (or a long gap) looks. */
export const MAX_LOOKBACK_DAYS = 7;

/** Releases read before their notices are written: one Find a Tender page. */
export const WRITE_BATCH = 100;

/**
 * A checkpoint trails the newest release read by a day, so a release that
 * reaches the feed late is read again after a timeout rather than skipped.
 */
const CHECKPOINT_OVERLAP_MS = 86_400_000;

type WatchRow = { organizationId: string; cpvPrefixes: string[]; regions: string[]; keywords: string[]; minValue: Prisma.Decimal | null; lastCheckedAt: Date | null };

const criteria = (w: WatchRow): WatchCriteria => ({
  cpvPrefixes: w.cpvPrefixes,
  regions: w.regions,
  keywords: w.keywords,
  minValue: w.minValue == null ? null : Number(w.minValue),
});

/** Still open: a deadline in the future, or none given. */
const open = (n: NoticeSummary, now: Date) => n.stage === "tender" && (!n.deadline || n.deadline > now);

const opportunityData = (n: NoticeSummary) => ({
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
  flags: tenderFlags(n) as unknown as Prisma.InputJsonValue,
});

type OpportunityData = ReturnType<typeof opportunityData> & { matchedOn: string };
type Pending = { organizationId: string; noticeId: string; data: OpportunityData };

const key = (organizationId: string, noticeId: string) => `${organizationId}\u0000${noticeId}`;

/**
 * Writes one batch with two round trips for new notices and one transaction
 * for changed ones, instead of a lookup and a write per notice and watch.
 * Returns how many rows were added.
 */
async function writeBatch(pending: Pending[]): Promise<number> {
  if (!pending.length) return 0;
  // The same notice can arrive on two pages; the later copy wins.
  const rows = [...new Map(pending.map((p) => [key(p.organizationId, p.noticeId), p])).values()];
  const existing = await prisma.tenderOpportunity.findMany({
    where: {
      organizationId: { in: [...new Set(rows.map((r) => r.organizationId))] },
      noticeId: { in: [...new Set(rows.map((r) => r.noticeId))] },
    },
    select: { id: true, organizationId: true, noticeId: true },
  });
  const ids = new Map(existing.map((e) => [key(e.organizationId, e.noticeId), e.id]));

  const fresh: Pending[] = [];
  const changed: { id: string; data: OpportunityData }[] = [];
  for (const r of rows) {
    const id = ids.get(key(r.organizationId, r.noticeId));
    if (id) changed.push({ id, data: r.data });
    else fresh.push(r);
  }

  let added = 0;
  if (fresh.length) {
    const res = await prisma.tenderOpportunity.createMany({
      data: fresh.map((r) => ({ ...r.data, organizationId: r.organizationId, noticeId: r.noticeId })),
      skipDuplicates: true,
    });
    added = res.count;
  }
  if (changed.length) {
    await prisma.$transaction(changed.map((c) => prisma.tenderOpportunity.update({ where: { id: c.id }, data: c.data })));
  }
  return added;
}

export type WatchRunResult = { checked: number; notices: number; added: number };

/**
 * Checks the enabled watches (one organisation's, when given). Idempotent: a
 * notice already recorded for an organisation is updated, never duplicated,
 * and its status is kept.
 *
 * Progress is saved every WRITE_BATCH releases. If the run is cut off (the
 * monitor route has a 60 s limit), the next run starts from the last saved
 * point instead of repeating the whole window.
 */
export async function runTenderWatches(opts: { organizationId?: string; now?: Date } = {}): Promise<WatchRunResult> {
  const now = opts.now ?? new Date();
  const watches: WatchRow[] = await prisma.tenderWatch.findMany({
    where: { enabled: true, ...(opts.organizationId ? { organizationId: opts.organizationId } : {}) },
    select: { organizationId: true, cpvPrefixes: true, regions: true, keywords: true, minValue: true, lastCheckedAt: true },
  });
  if (!watches.length) return { checked: 0, notices: 0, added: 0 };

  const orgIds = watches.map((w) => w.organizationId);
  const floor = new Date(now.getTime() - MAX_LOOKBACK_DAYS * 86_400_000);
  const from = watches.reduce((min, w) => {
    const since = w.lastCheckedAt && w.lastCheckedAt > floor ? w.lastCheckedAt : floor;
    return since < min ? since : min;
  }, now);

  let notices = 0;
  let added = 0;
  let pending: Pending[] = [];
  let seen = 0;
  let newest: Date | null = null;
  let checkpoint: Date | null = null;

  const flush = async () => {
    added += await writeBatch(pending);
    pending = [];
    seen = 0;
    if (!newest) return;
    const next = new Date(Math.max(from.getTime(), newest.getTime() - CHECKPOINT_OVERLAP_MS));
    if (checkpoint && next <= checkpoint) return;
    checkpoint = next;
    await prisma.tenderWatch.updateMany({
      where: { organizationId: { in: orgIds }, OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: next } }] },
      data: { lastCheckedAt: next },
    });
  };

  for await (const release of fetchTenderReleases(from, now)) {
    const released = releasedAt(release);
    if (released && (!newest || released > newest)) newest = released;

    const n = summariseRelease(release);
    if (open(n, now)) {
      notices++;
      const base = opportunityData(n);
      for (const w of watches) {
        const matchedOn = matchWatch(n, criteria(w));
        if (matchedOn) pending.push({ organizationId: w.organizationId, noticeId: n.noticeId, data: { ...base, matchedOn } });
      }
    }
    if (++seen >= WRITE_BATCH) await flush();
  }
  await flush();

  await prisma.tenderWatch.updateMany({
    where: { organizationId: { in: orgIds } },
    data: { lastCheckedAt: now },
  });
  return { checked: watches.length, notices, added };
}

function releasedAt(r: OcdsRelease): Date | null {
  if (!r.date) return null;
  const d = new Date(r.date);
  return Number.isNaN(d.getTime()) ? null : d;
}
