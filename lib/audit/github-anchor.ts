// Off-platform copy of each organisation's audit-chain head. lib/audit/anchor.ts keeps a copy in
// object storage, which anyone with the Supabase service role key can rewrite. This one is
// committed weekly to the `audit-anchors` branch of the GitHub repository by
// .github/workflows/audit-anchor.yml, so rewriting it needs GitHub write access as well.
// The branch only ever grows: the workflow checks every earlier head against the database before
// it adds a new one, and stops (leaving the branch as it was) when one no longer matches.

export interface HeadAnchor {
  headSeq: string;
  headHash: string;
}

/** `latest.json` on the audit-anchors branch: one entry per organisation, plus when it was written. */
export interface AnchorFile {
  anchoredAt: string;
  heads: Record<string, HeadAnchor>;
}

export type AnchorProblem =
  /** The anchored row no longer exists: the chain was cut short after the anchor. */
  | { organizationId: string; kind: "truncated"; headSeq: string }
  /** The anchored row carries another hash: its contents or link were changed. */
  | { organizationId: string; kind: "rewritten"; headSeq: string; anchored: string; found: string | null };

const SEQ_RE = /^\d+$/;

/** Reads `latest.json`; anything that is not an anchor file this code wrote is treated as none. */
export function parseAnchorFile(text: string | null): AnchorFile | null {
  if (!text) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const { anchoredAt, heads } = parsed as Partial<AnchorFile>;
  if (typeof anchoredAt !== "string" || !heads || typeof heads !== "object") return null;
  const clean: Record<string, HeadAnchor> = {};
  for (const [org, head] of Object.entries(heads)) {
    if (head && typeof head.headSeq === "string" && SEQ_RE.test(head.headSeq) && typeof head.headHash === "string") {
      clean[org] = { headSeq: head.headSeq, headHash: head.headHash };
    }
  }
  return { anchoredAt, heads: clean };
}

/**
 * Compares earlier anchors with the chain as it is now. `rowHash` returns the stored hash of the
 * row at that sequence, or undefined when there is no such row.
 */
export async function findAnchorProblems(
  previous: AnchorFile | null,
  rowHash: (organizationId: string, seq: string) => Promise<string | null | undefined>,
): Promise<AnchorProblem[]> {
  if (!previous) return [];
  const problems: AnchorProblem[] = [];
  for (const [organizationId, head] of Object.entries(previous.heads)) {
    const found = await rowHash(organizationId, head.headSeq);
    if (found === undefined) problems.push({ organizationId, kind: "truncated", headSeq: head.headSeq });
    else if (found !== head.headHash) {
      problems.push({ organizationId, kind: "rewritten", headSeq: head.headSeq, anchored: head.headHash, found });
    }
  }
  return problems;
}

/**
 * The next anchor file: current heads for every organisation, keeping an earlier head for an
 * organisation that has none now (its rows were all removed, which findAnchorProblems reports).
 */
export function buildAnchorFile(
  previous: AnchorFile | null,
  current: Record<string, HeadAnchor>,
  now: Date,
): AnchorFile {
  return { anchoredAt: now.toISOString(), heads: { ...(previous?.heads ?? {}), ...current } };
}
