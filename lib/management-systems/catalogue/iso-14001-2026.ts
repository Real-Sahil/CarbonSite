import { iso14001 } from "./iso-14001-2015";
import { revise } from "./revise";

// ISO 14001:2026, published 15 April 2026 on ISO's harmonized structure.
// Built from the 2015 catalogue: the clauses the revision kept carry over,
// and the changes below come from certification body and consultancy
// clause-by-clause notes (editionSources), not from the standard's text.
// Clause references with MetricOra's own titles and guidance only; check
// them against your licensed copy.
export const iso14001_2026 = revise({
  base: iso14001,
  meta: {
    slug: "iso-14001-2026",
    name: "ISO 14001 Environmental management systems",
    shortName: "ISO 14001:2026",
    edition: "2026",
    summary:
      "The 2026 edition of the environmental management system standard: the same system as 2015 on ISO's harmonized structure, with broader context (climate, biodiversity, resources), risks and opportunities in their own clause, planned changes, and control of externally provided processes, products and services with a life cycle view.",
    sourceUrl: "https://www.iso.org/iso-14001-environmental-management.html",
    contentNote:
      "Clause references with MetricOra's own titles and guidance, built from the 2015 edition and published notes on the 2026 changes. The standard's text is not reproduced: work from your own licensed copy of ISO 14001:2026 and check the clause titles against it.",
    transitionDeadline: "2029-04-30",
    editionSources: [
      { label: "DNV: ISO 14001:2026 published", url: "https://www.dnv.us/news/2026/ba_iso_14001_final_version/" },
      { label: "Amtivo: transition to 30 April 2029", url: "https://amtivo.com/uk/standards/iso-14001/technical/revisions/" },
      { label: "CQI: key updates to ISO 14001:2026", url: "https://www.quality.org/article/key-updates-iso-140012026" },
      { label: "Kaizen ISO Consulting: clause-by-clause comparison", url: "https://kaizenisoconsulting.com/articles/iso-14001-2026-clause-by-clause-comparison" },
    ],
  },
  remove: ["10.3"],
  set: [
    {
      code: "4.1",
      parent: "4",
      title: "Internal and external issues",
      sharedKey: "hls:4.1",
      guidance:
        "Record the internal and external issues that affect what your environmental management system can achieve. The 2026 edition names the environmental conditions to consider more specifically, such as climate change, biodiversity and ecosystems, pollution and the availability of natural resources, both those you affect and those that affect you.",
      evidenceHints: ["Context review covering climate, biodiversity, pollution and resources", "Minutes where the issues were agreed"],
      signals: ["emissions_monitoring"],
      editionChange: { kind: "changed", note: "Broadened: environmental conditions are named more specifically (climate, biodiversity, pollution, resources) rather than left general." },
    },
    {
      code: "6.1.1",
      parent: "6.1",
      title: "General",
      sharedKey: "hls:6.1",
      guidance: "Keep the processes you need to plan for aspects, compliance obligations, and risks and opportunities. The detail of each now sits in its own sub-clause.",
      evidenceHints: ["Planning procedure"],
      editionChange: { kind: "changed", from: ["6.1.1"], note: "Simplified to the planning processes; risks and opportunities moved to their own sub-clause (6.1.4)." },
    },
    {
      code: "6.1.2",
      parent: "6.1",
      title: "Environmental aspects",
      guidance:
        "Keep a register of the environmental aspects of your activities, products and services and their impacts, covering normal, abnormal and emergency conditions, and decide which are significant. The 2026 edition adds that the life cycle perspective applies when you identify and assess them and when you determine potential emergencies.",
      evidenceHints: ["Aspects and impacts register with significance criteria", "Life cycle stages considered"],
      signals: ["environmental_aspects"],
      editionChange: { kind: "changed", note: "A note makes the life cycle perspective apply to risk identification, assessment and emergency situations." },
    },
    {
      code: "6.1.3",
      parent: "6.1",
      title: "Compliance obligations",
      guidance:
        "Identify the legal and other requirements that apply to your aspects and how they apply to you, and show how each is addressed through the management system, for example by linking it to the control, objective or check that meets it.",
      evidenceHints: ["Legal register with the control or process for each obligation", "Permits and exemptions"],
      signals: ["legal_register", "environmental_permits"],
      editionChange: { kind: "changed", note: "Obligations are to be addressed through the management system, so trace each one to what meets it." },
    },
    {
      code: "6.1.4",
      parent: "6.1",
      title: "Risks and opportunities",
      guidance:
        "Determine the risks and opportunities to address, drawing on your issues (4.1), interested parties (4.2), aspects and compliance obligations, so the system achieves its intended outcomes and prevents or reduces undesired effects.",
      evidenceHints: ["Risk and opportunity register"],
      editionChange: { kind: "new", from: ["6.1.1"], note: "New dedicated sub-clause; in 2015 risks and opportunities were part of 6.1.1." },
    },
    {
      code: "6.1.5",
      parent: "6.1",
      title: "Planning action",
      after: "6.1.4",
      guidance: "Plan how you will act on significant aspects, obligations and risks and opportunities, integrate the actions into objectives (6.2), support (7), operation (8) and monitoring (9.1), and check that they worked.",
      evidenceHints: ["Action plan", "Operational controls linked to significant aspects"],
      editionChange: { kind: "renumbered", from: ["6.1.4"], note: "Was 6.1.4 in 2015; substance unchanged, now names the clauses actions integrate with." },
    },
    {
      code: "6.3",
      parent: "6",
      title: "Planning of changes",
      after: "6.2.2",
      guidance:
        "When you change the environmental management system (sites, processes, organisation, scope), plan the change so its intended outcomes are kept and unintended environmental impacts are avoided: purpose, consequences, resources and responsibilities.",
      evidenceHints: ["Change requests with environmental review", "Management of change records"],
      editionChange: { kind: "new", note: "New clause from the harmonized structure: changes to the system are planned." },
    },
    {
      code: "8.1",
      parent: "8",
      title: "Operational planning and control",
      sharedKey: "hls:8.1",
      guidance:
        "Set operating criteria for the processes that interact with the environment and control them, including externally provided processes, products and services (not only outsourced processes). Apply a life cycle perspective across design, procurement, requirements passed to external providers, and the use and end of life of what you deliver.",
      evidenceHints: ["Approved method statements", "Site environmental plans", "Environmental requirements in subcontracts and purchase orders"],
      signals: ["method_statements", "environmental_permits", "suppliers"],
      editionChange: { kind: "changed", note: "Widened from outsourced processes to externally provided processes, products and services, with the life cycle perspective." },
    },
    { code: "9.3", parent: "9", title: "Management review", editionChange: { kind: "changed", note: "Split into 9.3.1 General, 9.3.2 Inputs and 9.3.3 Results." } },
    {
      code: "9.3.1",
      parent: "9.3",
      title: "General",
      after: "9.3",
      sharedKey: "hls:9.3",
      guidance: "Top management reviews the environmental management system at planned intervals for suitability, adequacy and effectiveness.",
      evidenceHints: ["Management review schedule"],
      editionChange: { kind: "renumbered", from: ["9.3"], note: "Was part of 9.3." },
    },
    {
      code: "9.3.2",
      parent: "9.3",
      title: "Management review inputs",
      after: "9.3.1",
      guidance: "Cover the set inputs: status of previous actions, changes in issues, interested parties, aspects and obligations, objectives, performance, audit results, resources, complaints and opportunities for improvement.",
      evidenceHints: ["Management review agenda and inputs"],
      editionChange: { kind: "renumbered", from: ["9.3"], note: "Was part of 9.3; same input areas, now listed in their own sub-clause." },
    },
    {
      code: "9.3.3",
      parent: "9.3",
      title: "Management review results",
      after: "9.3.2",
      guidance: "Record the conclusions and decisions: continuing suitability, improvement opportunities, changes needed, actions, resources and links to business strategy.",
      evidenceHints: ["Management review minutes with decisions and actions"],
      editionChange: { kind: "renumbered", from: ["9.3"], note: "Was part of 9.3." },
    },
    {
      code: "10.1",
      parent: "10",
      title: "Continual improvement",
      sharedKey: "hls:10.3",
      guidance: "Continually improve the suitability, adequacy and effectiveness of the system to enhance environmental performance, and show it improving over time.",
      evidenceHints: ["Year-on-year performance trends", "Improvement actions"],
      signals: ["emissions_monitoring"],
      editionChange: { kind: "renumbered", from: ["10.1", "10.3"], note: "2015's 10.1 General and 10.3 Continual improvement are merged into 10.1." },
    },
  ],
});
