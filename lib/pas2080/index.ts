// PAS 2080:2023 carbon management in buildings and infrastructure. A
// project's plan (its value chain role, accountable lead, baseline, target
// and the life cycle modules they cover) and its log of carbon reduction
// opportunities, each tested against the reduction hierarchy. Pure
// functions here; loading lives in ./load.ts.

import { z } from "zod";
import type { CarbonHierarchyLevel, CarbonOpportunityStatus, ValueChainRole } from "@prisma/client";

/** Most effective first, as PAS 2080:2023 orders them. */
export const HIERARCHY: { level: CarbonHierarchyLevel; label: string; prompt: string }[] = [
  { level: "build_nothing", label: "Build nothing", prompt: "Question the need: can the outcome be met without new construction?" },
  { level: "build_less", label: "Build less", prompt: "Make more of existing assets and cut the quantity of new material." },
  { level: "build_clever", label: "Build clever", prompt: "Choose low-carbon solutions, materials and designs." },
  { level: "build_efficiently", label: "Build efficiently", prompt: "Construct, operate and maintain with less carbon and waste." },
];

export const ROLE_LABELS: Record<ValueChainRole, string> = {
  asset_owner: "Asset owner / manager",
  designer: "Designer",
  constructor: "Constructor",
  product_supplier: "Product / material supplier",
};

export const STATUS_LABELS: Record<CarbonOpportunityStatus, string> = {
  identified: "Identified",
  under_review: "Under review",
  adopted: "Adopted",
  implemented: "Implemented",
  rejected: "Rejected",
};

/** EN 17472 / EN 15978 life cycle modules a plan can declare. */
export const LIFECYCLE_MODULES = [
  "A0", "A1-A3", "A4", "A5",
  "B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8",
  "C1", "C2", "C3", "C4", "D",
] as const;

const moduleList = z.array(z.enum(LIFECYCLE_MODULES)).max(LIFECYCLE_MODULES.length);
const tonnes = z.coerce.number().min(0).max(1e9);

export const planSchema = z.object({
  valueChainRole: z.enum(["asset_owner", "designer", "constructor", "product_supplier"]),
  carbonLeadName: z.string().trim().max(120).nullish(),
  baselineTco2e: tonnes.nullish(),
  baselineBasis: z.string().trim().max(2000).nullish(),
  targetTco2e: tonnes.nullish(),
  modulesInScope: moduleList.default([]),
  notes: z.string().trim().max(4000).nullish(),
});

export const opportunitySchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).nullish(),
  hierarchyLevel: z.enum(["build_nothing", "build_less", "build_clever", "build_efficiently"]),
  workStage: z.string().trim().max(80).nullish(),
  lifecycleModules: moduleList.default([]),
  estimatedSavingTco2e: tonnes.nullish(),
  status: z.enum(["identified", "under_review", "adopted", "implemented", "rejected"]).default("identified"),
  decisionRationale: z.string().trim().max(4000).nullish(),
  ownerName: z.string().trim().max(120).nullish(),
});

/** A decision needs its reason on record; a rejection most of all. */
export function opportunityProblem(o: { status: string; decisionRationale?: string | null }): string | null {
  if (o.status === "rejected" && !o.decisionRationale?.trim()) {
    return "Record why the opportunity was rejected.";
  }
  return null;
}

export type PlanInput = {
  valueChainRole: ValueChainRole;
  carbonLeadName: string | null;
  baselineTco2e: number | null;
  baselineBasis: string | null;
  targetTco2e: number | null;
  modulesInScope: string[];
};

export type OpportunityInput = {
  hierarchyLevel: CarbonHierarchyLevel;
  status: CarbonOpportunityStatus;
  estimatedSavingTco2e: number | null;
  decisionRationale: string | null;
};

export type Pas2080Position = {
  baseline: number | null;
  target: number | null;
  /** Savings from adopted and implemented opportunities. */
  committedSavings: number;
  /** Savings still under consideration (identified or under review). */
  pipelineSavings: number;
  /** Baseline less committed savings. */
  forecast: number | null;
  /** Forecast minus target: positive means more reduction is needed. */
  gapToTarget: number | null;
  measured: number;
  byLevel: { level: CarbonHierarchyLevel; label: string; committed: number; pipeline: number; count: number; rejected: number }[];
};

const committed = (s: CarbonOpportunityStatus) => s === "adopted" || s === "implemented";
const pipeline = (s: CarbonOpportunityStatus) => s === "identified" || s === "under_review";

export function pas2080Position(plan: PlanInput | null, opportunities: OpportunityInput[], measuredTco2e: number): Pas2080Position {
  const byLevel = HIERARCHY.map((h) => {
    const mine = opportunities.filter((o) => o.hierarchyLevel === h.level);
    const sum = (pred: (s: CarbonOpportunityStatus) => boolean) =>
      mine.filter((o) => pred(o.status)).reduce((t, o) => t + (o.estimatedSavingTco2e ?? 0), 0);
    return {
      level: h.level,
      label: h.label,
      committed: sum(committed),
      pipeline: sum(pipeline),
      count: mine.length,
      rejected: mine.filter((o) => o.status === "rejected").length,
    };
  });
  const committedSavings = byLevel.reduce((t, l) => t + l.committed, 0);
  const pipelineSavings = byLevel.reduce((t, l) => t + l.pipeline, 0);
  const baseline = plan?.baselineTco2e ?? null;
  const target = plan?.targetTco2e ?? null;
  const forecast = baseline != null ? Math.max(0, baseline - committedSavings) : null;
  return {
    baseline,
    target,
    committedSavings,
    pipelineSavings,
    forecast,
    gapToTarget: forecast != null && target != null ? forecast - target : null,
    measured: measuredTco2e,
    byLevel,
  };
}

export type Pas2080Check = { id: string; area: string; description: string; passed: boolean; required: boolean; message?: string };

/**
 * The plan checked against what PAS 2080:2023 expects of a project team:
 * defined roles and leadership, a quantified baseline and target within a
 * declared boundary, reduction worked down the hierarchy with decisions
 * recorded, and carbon monitored during delivery.
 */
export function pas2080Checks(plan: PlanInput | null, opportunities: OpportunityInput[], position: Pas2080Position): Pas2080Check[] {
  const higher = opportunities.filter((o) => o.hierarchyLevel === "build_nothing" || o.hierarchyLevel === "build_less");
  const unexplained = opportunities.filter((o) => opportunityProblem(o));
  const checks: Pas2080Check[] = [
    {
      id: "role", area: "Leadership and roles", required: true,
      description: "The project's value chain role is set",
      passed: !!plan,
      message: "Say whether you are the asset owner, designer, constructor or product supplier on this project.",
    },
    {
      id: "lead", area: "Leadership and roles", required: true,
      description: "A named person is accountable for carbon",
      passed: !!plan?.carbonLeadName,
      message: "Name the project's carbon lead.",
    },
    {
      id: "boundary", area: "Quantification", required: true,
      description: "The life cycle modules in scope are declared",
      passed: (plan?.modulesInScope.length ?? 0) > 0,
      message: "Choose the modules (e.g. A1-A5, B6, C1-C4) that the baseline, target and monitoring cover.",
    },
    {
      id: "baseline", area: "Baseline and targets", required: true,
      description: "A baseline is quantified and its basis recorded",
      passed: plan?.baselineTco2e != null && !!plan.baselineBasis,
      message: "Enter the business-as-usual baseline in tCO2e and how it was set.",
    },
    {
      id: "target", area: "Baseline and targets", required: true,
      description: "A reduction target below the baseline is set",
      passed: plan?.targetTco2e != null && plan.baselineTco2e != null && plan.targetTco2e < plan.baselineTco2e,
      message: "Set a target in tCO2e below the baseline.",
    },
    {
      id: "hierarchy", area: "Carbon reduction", required: true,
      description: "Build nothing and build less have been considered",
      passed: higher.length > 0,
      message: "Log at least one build nothing or build less option, even if rejected, before relying on material and site efficiencies.",
    },
    {
      id: "decisions", area: "Carbon reduction", required: true,
      description: "Every rejected opportunity has a recorded reason",
      passed: unexplained.length === 0,
      message: `${unexplained.length} rejected ${unexplained.length === 1 ? "opportunity has" : "opportunities have"} no reason recorded.`,
    },
    {
      id: "monitoring", area: "Monitoring and reporting", required: false,
      description: "Carbon is being measured during delivery",
      passed: position.measured > 0,
      message: "No embodied carbon or site activity is recorded against this project yet. Approve delivery notes and site records to start measuring.",
    },
    {
      id: "on-track", area: "Monitoring and reporting", required: false,
      description: "Committed reductions meet the target",
      passed: position.gapToTarget != null && position.gapToTarget <= 0,
      message:
        position.gapToTarget != null
          ? `Committed savings leave ${position.gapToTarget.toFixed(1)} tCO2e to find to reach the target.`
          : "Set a baseline and target to track this.",
    },
  ];
  return checks.map((c) => (c.passed ? { ...c, message: undefined } : c));
}
