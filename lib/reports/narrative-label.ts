import type { AuditNarrative } from "./narrative-generator";

/** The line printed under a report's summary heading, so the reader knows who wrote it. */
export function narrativeLabel(n: Pick<AuditNarrative, "source" | "aiDrafted">): string {
  if (n.source === "team") {
    return n.aiDrafted
      ? "Written by the reporting team, starting from an AI-assisted draft that the team reviewed and edited."
      : "Written by the reporting team.";
  }
  return "Wording drafted with AI assistance from the figures in this report; every figure is taken from the report data.";
}
