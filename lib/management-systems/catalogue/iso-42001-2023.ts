import type { CatalogueFramework } from "./types";
import { controls, harmonizedClauses } from "./hls";

// ISO/IEC 42001:2023 AI management systems. Clause and Annex A references with
// MetricOra's own short titles and guidance; the standard's text is not
// reproduced.

const ANNEX: Array<[string, string, ReadonlyArray<readonly [string, string, string]>]> = [
  ["A.2", "Policies related to AI", [
    ["A.2.2", "AI policy", "A documented policy for developing or using AI systems."],
    ["A.2.3", "Alignment with other organisational policies", "Decide where other policies are affected by or apply to AI."],
    ["A.2.4", "Review of the AI policy", "Review the AI policy at planned intervals."],
  ]],
  ["A.3", "Internal organisation", [
    ["A.3.2", "AI roles and responsibilities", "Define and allocate roles for AI."],
    ["A.3.3", "Reporting of concerns", "A way for people to report concerns about AI systems."],
  ]],
  ["A.4", "Resources for AI systems", [
    ["A.4.2", "Resource documentation", "Identify and document the resources each AI system needs."],
    ["A.4.3", "Data resources", "Document the data resources used."],
    ["A.4.4", "Tooling resources", "Document the tools used."],
    ["A.4.5", "System and computing resources", "Document system and computing resources."],
    ["A.4.6", "Human resources", "Document the people and competences involved."],
  ]],
  ["A.5", "Assessing impacts of AI systems", [
    ["A.5.2", "AI system impact assessment process", "A process to assess potential consequences of AI systems for individuals, groups and society."],
    ["A.5.3", "Documentation of AI system impact assessments", "Document and retain impact assessment results."],
    ["A.5.4", "Assessing impact on individuals or groups", "Assess impacts on individuals and groups over the system's life cycle."],
    ["A.5.5", "Assessing societal impacts", "Assess societal impacts over the life cycle."],
  ]],
  ["A.6", "AI system life cycle", [
    ["A.6.1.2", "Objectives for responsible development", "Set objectives for responsible development and integrate them into the life cycle."],
    ["A.6.1.3", "Processes for responsible design and development", "Define processes for responsible design and development."],
    ["A.6.2.2", "Requirements and specification", "Specify requirements for new AI systems or major changes."],
    ["A.6.2.3", "Documentation of design and development", "Document design and development."],
    ["A.6.2.4", "Verification and validation", "Define and apply verification and validation measures."],
    ["A.6.2.5", "Deployment", "Plan and document deployment."],
    ["A.6.2.6", "Operation and monitoring", "Define what is needed to operate and monitor AI systems."],
    ["A.6.2.7", "Technical documentation", "Provide technical documentation to the parties who need it."],
    ["A.6.2.8", "Recording of event logs", "Decide when event logging is enabled over the life cycle."],
  ]],
  ["A.7", "Data for AI systems", [
    ["A.7.2", "Data for development and enhancement", "Manage data used to develop and improve AI systems."],
    ["A.7.3", "Acquisition of data", "Document how data is acquired and selected."],
    ["A.7.4", "Quality of data", "Define and meet data quality requirements."],
    ["A.7.5", "Data provenance", "Record the provenance of data over its life cycle."],
    ["A.7.6", "Data preparation", "Define criteria and methods for preparing data."],
  ]],
  ["A.8", "Information for interested parties", [
    ["A.8.2", "System documentation and information for users", "Give users the information they need about the AI system."],
    ["A.8.3", "External reporting", "Let interested parties report adverse impacts."],
    ["A.8.4", "Communication of incidents", "Plan how incidents are communicated to users."],
    ["A.8.5", "Information for interested parties", "Decide and document what information to give interested parties."],
  ]],
  ["A.9", "Use of AI systems", [
    ["A.9.2", "Processes for responsible use", "Define processes for responsible use of AI systems."],
    ["A.9.3", "Objectives for responsible use", "Set objectives guiding responsible use."],
    ["A.9.4", "Intended use", "Use AI systems according to their intended use and documentation."],
  ]],
  ["A.10", "Third-party and customer relationships", [
    ["A.10.2", "Allocating responsibilities", "Allocate responsibilities between you, partners, suppliers and customers."],
    ["A.10.3", "Suppliers", "Make sure supplied services, products and materials fit your responsible AI approach."],
    ["A.10.4", "Customers", "Consider customers' expectations and needs for responsible AI."],
  ]],
];

export const iso42001: CatalogueFramework = {
  slug: "iso-42001-2023",
  name: "ISO/IEC 42001 AI management systems",
  shortName: "ISO 42001",
  edition: "2023",
  publisher: "ISO and IEC",
  family: "ai",
  summary: "Requirements for managing the development and use of AI responsibly: AI risk and impact assessment, life cycle controls, data, transparency and third-party relationships.",
  sourceUrl: "https://www.iso.org/standard/81230.html",
  contentBasis: "references",
  contentNote: "Clause and Annex A references with MetricOra's own titles and guidance. The standard's text is not reproduced: work from your own licensed copy of ISO/IEC 42001.",
  certifiable: true,
  requirements: [
    ...harmonizedClauses({
      topic: "AI",
      planning: [
        { code: "6.1.2", title: "AI risk assessment", guidance: "A defined AI risk assessment process covering risks to the organisation, individuals and society." },
        { code: "6.1.3", title: "AI risk treatment", guidance: "Choose treatments, compare them with Annex A and produce a Statement of Applicability." , evidenceHints: ["Statement of Applicability"] },
        { code: "6.1.4", title: "AI system impact assessment", guidance: "Assess the potential consequences of AI systems for individuals, groups and societies." },
      ],
      operation: [
        { code: "8.2", title: "AI risk assessment", guidance: "Perform AI risk assessments at planned intervals and after significant change." },
        { code: "8.3", title: "AI risk treatment", guidance: "Implement the AI risk treatment plan and verify it works." },
        { code: "8.4", title: "AI system impact assessment", guidance: "Perform AI system impact assessments at planned intervals and after significant change." },
      ],
    }),
    ...ANNEX.flatMap(([code, title, rows]) => [{ code, title: `Annex A: ${title}` }, ...controls(code, rows)]),
  ],
};
