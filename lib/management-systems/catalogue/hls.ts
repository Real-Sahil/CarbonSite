import type { CatalogueRequirement } from "./types";

// Clauses 4 to 10 as ISO's harmonized structure lays them out for a
// management system standard, worded for one discipline. Used by the
// standards whose clause numbering follows it exactly (ISO/IEC 27001:2022 and
// ISO/IEC 42001:2023); ISO 9001, 14001 and 45001 carry their own because their
// sub-clauses differ. Titles and guidance are MetricOra's own.

type Options = {
  /** e.g. "information security", "AI". */
  topic: string;
  /** Sub-clauses inserted under 6.1 after 6.1.1, e.g. risk assessment and treatment. */
  planning: CatalogueRequirement[];
  /** Sub-clauses of clause 8 after 8.1. */
  operation: CatalogueRequirement[];
};

export function harmonizedClauses({ topic, planning, operation }: Options): CatalogueRequirement[] {
  return [
    { code: "4", title: "Context of the organisation" },
    { code: "4.1", parent: "4", title: "Internal and external issues", sharedKey: "hls:4.1", guidance: `Record the issues that affect your ${topic} management system, and whether climate change is relevant (Amd 1:2024).`, evidenceHints: ["Context review"] },
    { code: "4.2", parent: "4", title: "Interested parties and their requirements", sharedKey: "hls:4.2", guidance: `List interested parties relevant to ${topic} and which of their requirements the system addresses.`, evidenceHints: ["Interested parties register"] },
    { code: "4.3", parent: "4", title: "Scope of the management system", sharedKey: "hls:4.3", guidance: "Define and document the scope, including interfaces and dependencies with activities outside it.", evidenceHints: ["Scope statement"] },
    { code: "4.4", parent: "4", title: "The management system", sharedKey: "hls:4.4", guidance: "Establish, implement, maintain and improve the system and its processes." },
    { code: "5", title: "Leadership" },
    { code: "5.1", parent: "5", title: "Leadership and commitment", sharedKey: "hls:5.1", guidance: `Top management directs and supports the ${topic} management system and integrates it into business processes.`, evidenceHints: ["Board minutes"] },
    { code: "5.2", parent: "5", title: "Policy", sharedKey: "hls:5.2", guidance: `A ${topic} policy that fits the organisation, sets a framework for objectives and commits to meeting requirements and improving; communicated and available.`, evidenceHints: ["Signed policy"] },
    { code: "5.3", parent: "5", title: "Roles, responsibilities and authorities", sharedKey: "hls:5.3", guidance: "Assign and communicate responsibilities, including reporting on the system's performance.", evidenceHints: ["Organisation chart"], signals: ["members"] },
    { code: "6", title: "Planning" },
    { code: "6.1", parent: "6", title: "Actions to address risks and opportunities" },
    { code: "6.1.1", parent: "6.1", title: "General", sharedKey: "hls:6.1", guidance: "Determine the risks and opportunities to address so the system achieves its intended outcomes." },
    ...planning.map((r) => ({ ...r, parent: r.parent ?? "6.1" })),
    { code: "6.2", parent: "6", title: "Objectives and planning to achieve them", sharedKey: "hls:6.2", guidance: `Measurable ${topic} objectives with actions, resources, owners, dates and evaluation.`, evidenceHints: ["Objectives register"] },
    { code: "6.3", parent: "6", title: "Planning of changes", guidance: "Carry out changes to the system in a planned way.", evidenceHints: ["Change records"] },
    { code: "7", title: "Support" },
    { code: "7.1", parent: "7", title: "Resources", sharedKey: "hls:7.1", guidance: "Provide the resources the system needs." },
    { code: "7.2", parent: "7", title: "Competence", sharedKey: "hls:7.2", guidance: "People doing work that affects the system are competent, with evidence.", evidenceHints: ["Training records"] },
    { code: "7.3", parent: "7", title: "Awareness", sharedKey: "hls:7.3", guidance: `People know the ${topic} policy, their contribution and the implications of not conforming.` },
    { code: "7.4", parent: "7", title: "Communication", sharedKey: "hls:7.4", guidance: "Decide what, when, with whom and how to communicate internally and externally." },
    { code: "7.5", parent: "7", title: "Documented information", sharedKey: "hls:7.5", guidance: "Create, update and control the documents and records the standard and the system require.", evidenceHints: ["Document register"], signals: ["evidence_files"] },
    { code: "8", title: "Operation" },
    { code: "8.1", parent: "8", title: "Operational planning and control", sharedKey: "hls:8.1", guidance: "Plan, implement and control the processes needed, including externally provided ones." },
    ...operation.map((r) => ({ ...r, parent: r.parent ?? "8" })),
    { code: "9", title: "Performance evaluation" },
    { code: "9.1", parent: "9", title: "Monitoring, measurement, analysis and evaluation", sharedKey: "hls:9.1", guidance: `Decide what to monitor and measure, how and when, and evaluate ${topic} performance.`, evidenceHints: ["Metrics reports"] },
    { code: "9.2", parent: "9", title: "Internal audit", sharedKey: "hls:9.2", guidance: "Audit the system at planned intervals with objective auditors and report the results.", evidenceHints: ["Audit programme", "Audit reports"] },
    { code: "9.3", parent: "9", title: "Management review", sharedKey: "hls:9.3", guidance: "Top management reviews the system against the required inputs and records decisions.", evidenceHints: ["Management review minutes"] },
    { code: "10", title: "Improvement" },
    { code: "10.1", parent: "10", title: "Continual improvement", sharedKey: "hls:10.3", guidance: "Continually improve the suitability, adequacy and effectiveness of the system." },
    { code: "10.2", parent: "10", title: "Nonconformity and corrective action", sharedKey: "hls:10.2", guidance: "React to nonconformities, find causes, act to prevent recurrence and check effectiveness.", evidenceHints: ["Corrective action log"] },
  ];
}

/** Requirements from [code, title, guidance] rows under a parent heading. */
export function controls(parent: string, rows: ReadonlyArray<readonly [string, string, string]>, extra: Partial<CatalogueRequirement> = {}): CatalogueRequirement[] {
  return rows.map(([code, title, guidance]) => ({ code, parent, title, guidance, ...extra }));
}
