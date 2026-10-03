// Double materiality: the arithmetic and a starting list of topics. The
// assessment, its topics and their API already exist (MaterialityAssessment,
// MaterialityTopic); this adds the rules for scoring and the report summary.
//
// A topic row is an impact, risk or opportunity (IRO) scored 1 to 5 for impact
// materiality (the organisation's effect on people and the environment) and for
// financial materiality (the topic's effect on the organisation). It is
// material if either score reaches the threshold. The method (ESRS, GRI, ISSB)
// differs by jurisdiction, so the scale, the threshold and the reasoning are the
// organisation's own; the topic names follow the ESRS topic structure (public
// facts) and the organisation may add its own, for example sector-specific ones.

export const DEFAULT_THRESHOLD = 3;

export type Scores = { impactScore: number | null; financialScore: number | null };

/** Composite score: the higher of the two dimensions; null when neither is scored. */
export function compositeScore(s: Scores): number | null {
  const v = [s.impactScore, s.financialScore].filter((x): x is number => x != null);
  return v.length ? Math.max(...v) : null;
}

/** Material when either dimension reaches the threshold; false while unscored. */
export function isMaterialByScore(s: Scores, threshold = DEFAULT_THRESHOLD): boolean {
  const c = compositeScore(s);
  return c != null && c >= threshold;
}

export function basisOf(s: Scores, threshold = DEFAULT_THRESHOLD): "impact" | "financial" | "both" | null {
  const i = s.impactScore != null && s.impactScore >= threshold;
  const f = s.financialScore != null && s.financialScore >= threshold;
  return i && f ? "both" : i ? "impact" : f ? "financial" : null;
}

/** Topics to start from: one impact row per ESRS sub-topic, unscored. */
export const STARTER_TOPICS: { esrsCode: string; topicName: string }[] = [
  { esrsCode: "E1", topicName: "Climate change mitigation" },
  { esrsCode: "E1", topicName: "Climate change adaptation" },
  { esrsCode: "E1", topicName: "Energy" },
  { esrsCode: "E2", topicName: "Air pollution" },
  { esrsCode: "E2", topicName: "Water pollution" },
  { esrsCode: "E2", topicName: "Soil pollution" },
  { esrsCode: "E2", topicName: "Substances of concern" },
  { esrsCode: "E3", topicName: "Water" },
  { esrsCode: "E3", topicName: "Marine resources" },
  { esrsCode: "E4", topicName: "Direct drivers of biodiversity loss" },
  { esrsCode: "E4", topicName: "State of species" },
  { esrsCode: "E4", topicName: "Extent and condition of ecosystems" },
  { esrsCode: "E5", topicName: "Resource inflows, including resource use" },
  { esrsCode: "E5", topicName: "Resource outflows, including waste" },
  { esrsCode: "S1", topicName: "Own workforce: working conditions" },
  { esrsCode: "S1", topicName: "Own workforce: equal treatment and opportunities" },
  { esrsCode: "S1", topicName: "Own workforce: other work-related rights" },
  { esrsCode: "S2", topicName: "Value chain workers: working conditions" },
  { esrsCode: "S2", topicName: "Value chain workers: other work-related rights" },
  { esrsCode: "S3", topicName: "Affected communities" },
  { esrsCode: "S4", topicName: "Consumers and end-users" },
  { esrsCode: "G1", topicName: "Corporate culture and business conduct" },
  { esrsCode: "G1", topicName: "Protection of whistleblowers" },
  { esrsCode: "G1", topicName: "Corruption and bribery" },
  { esrsCode: "G1", topicName: "Management of supplier relationships, including payment practices" },
];

/** The starter topics an assessment does not have yet, matched on name ignoring case. */
export function missingStarterTopics(existingNames: string[]) {
  const have = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  return STARTER_TOPICS.filter((t) => !have.has(t.topicName.toLowerCase()));
}

export type TopicSummary = {
  esrsCode: string | null;
  topicName: string;
  iroType: string;
  impactScore: number | null;
  financialScore: number | null;
  isMaterial: boolean;
  rationale: string | null;
};

/** Material topics, grouped by ESRS standard code in order (E1, E2, ... G1; own topics last), strongest first. */
export function materialByStandard(topics: TopicSummary[]): { code: string; topics: TopicSummary[] }[] {
  const order = (c: string | null) => (c ? c : "~");
  const groups = new Map<string, TopicSummary[]>();
  for (const t of topics.filter((x) => x.isMaterial)) {
    const key = order(t.esrsCode);
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([code, list]) => ({
      code: code === "~" ? "Own topics" : code,
      topics: [...list].sort((a, b) => (compositeScore(b) ?? 0) - (compositeScore(a) ?? 0)),
    }));
}

export const IRO_LABELS: Record<string, string> = { impact: "Impact", risk: "Risk", opportunity: "Opportunity" };

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  stakeholder_review: "Stakeholder review",
  approved: "Approved",
  published: "Published",
};

export const FRAMEWORK_NOTE =
  "A double materiality assessment looks at a topic's impact on people and the environment and its effect on the organisation. The ESRS require it; GRI and the ISSB standards use related ideas. Whether one is required, and which method applies, depends on the organisation's jurisdiction. The scale, threshold and reasoning are the organisation's own.";
