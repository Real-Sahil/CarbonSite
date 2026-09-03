"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FlaskConical, Plus, Trash2, Loader2, TrendingDown, AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalculationRun {
  id: string;
  status: string;
  createdAt: string;
  reportingPeriod?: { label: string } | null;
}

interface Adjustment {
  scope: "" | "1" | "2" | "3";
  categoryId: string;
  facilityId: string;
  reductionPercent: number;
}

interface ScopeTotals {
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}

interface ScenarioResult {
  id: string;
  calculationRunId: string;
  createdAt: string;
  expiresAt: string;
  baseline: ScopeTotals;
  scenario: ScopeTotals;
  reduction: ScopeTotals & { totalPercent: number };
  draftsCount: number;
  topReductions: Array<{
    id: string;
    activityRecordId: string;
    scope: number;
    categoryName: string;
    categoryCode: string;
    baselineCo2e: number;
    scenarioCo2e: number;
    reduction: number;
    reductionPercent: number;
  }>;
}

interface ScenarioRunSummary {
  id: string;
  calculationRunId: string;
  createdAt: string;
  expiresAt: string;
  createdBy: { name: string | null; email: string } | null;
  calculationRun: {
    id: string;
    status: string;
    reportingPeriod?: { label: string } | null;
  } | null;
  _count: { drafts: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(tCo2e: number): string {
  if (tCo2e >= 1000) return `${(tCo2e / 1000).toFixed(1)} ktCO2e`;
  return `${tCo2e.toFixed(2)} tCO2e`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScopeCard({
  label,
  baseline,
  scenario,
  reduction,
  reductionPercent,
}: {
  label: string;
  baseline: number;
  scenario: number;
  reduction: number;
  reductionPercent: number;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-zinc-500">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Baseline</span>
          <span className="font-mono font-medium text-zinc-900">{fmt(baseline)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Scenario</span>
          <span className="font-mono font-medium text-zinc-900">{fmt(scenario)}</span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-green-50 px-2 py-1.5 text-xs">
          <span className="text-green-700 font-medium flex items-center gap-1">
            <TrendingDown className="h-3 w-3" />
            Reduction
          </span>
          <span className="font-mono font-semibold text-green-800">
            {fmt(reduction)} ({fmtPct(reductionPercent)})
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function AdjustmentRow({
  adj,
  index,
  onChange,
  onRemove,
}: {
  adj: Adjustment;
  index: number;
  onChange: (index: number, field: keyof Adjustment, value: string | number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
      {/* Scope selector */}
      <div className="flex flex-col gap-0.5 min-w-[100px]">
        <label className="text-xs text-zinc-500">Scope</label>
        <select
          value={adj.scope}
          onChange={(e) => onChange(index, "scope", e.target.value)}
          className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        >
          <option value="">All scopes</option>
          <option value="1">Scope 1</option>
          <option value="2">Scope 2</option>
          <option value="3">Scope 3</option>
        </select>
      </div>

      {/* Optional category ID */}
      <div className="flex flex-col gap-0.5 min-w-[140px]">
        <label className="text-xs text-zinc-500">Category ID (optional)</label>
        <Input
          placeholder="e.g. s3-business-travel"
          value={adj.categoryId}
          onChange={(e) => onChange(index, "categoryId", e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {/* Reduction % */}
      <div className="flex flex-col gap-0.5 min-w-[200px] flex-1">
        <label className="text-xs text-zinc-500">
          Reduction: <span className="font-semibold text-zinc-900">{adj.reductionPercent}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={adj.reductionPercent}
          onChange={(e) => onChange(index, "reductionPercent", Number(e.target.value))}
          className="w-full accent-zinc-900"
        />
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRemove(index)}
        className="text-zinc-400 hover:text-red-500 mt-4"
        aria-label="Remove adjustment"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ScenariosPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  // Form state
  const [calcRuns, setCalcRuns] = useState<CalculationRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [label, setLabel] = useState("");
  const [adjustments, setAdjustments] = useState<Adjustment[]>([
    { scope: "", categoryId: "", facilityId: "", reductionPercent: 20 },
  ]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Results state
  const [result, setResult] = useState<ScenarioResult | null>(null);

  // Past runs
  const [pastRuns, setPastRuns] = useState<ScenarioRunSummary[]>([]);
  const [loadingPastRuns, setLoadingPastRuns] = useState(true);

  // Fetch calculation runs for the selector
  useEffect(() => {
    fetch(`/api/orgs/${orgId}/calculation-runs`)
      .then((r) => r.json())
      .then((d) => {
        const runs: CalculationRun[] = (d.data ?? []).filter(
          (r: CalculationRun) => r.status === "succeeded",
        );
        setCalcRuns(runs);
        if (runs.length > 0) setSelectedRunId(runs[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingRuns(false));
  }, [orgId]);

  // Fetch past scenario runs
  const fetchPastRuns = useCallback(() => {
    fetch(`/api/orgs/${orgId}/scenarios`)
      .then((r) => r.json())
      .then((d) => setPastRuns(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingPastRuns(false));
  }, [orgId]);

  useEffect(() => {
    fetchPastRuns();
  }, [fetchPastRuns]);

  function addAdjustment() {
    setAdjustments((prev) => [
      ...prev,
      { scope: "", categoryId: "", facilityId: "", reductionPercent: 20 },
    ]);
  }

  function removeAdjustment(index: number) {
    setAdjustments((prev) => prev.filter((_, i) => i !== index));
  }

  function updateAdjustment(
    index: number,
    field: keyof Adjustment,
    value: string | number,
  ) {
    setAdjustments((prev) =>
      prev.map((adj, i) => (i === index ? { ...adj, [field]: value } : adj)),
    );
  }

  async function handleRunScenario() {
    if (!selectedRunId) {
      setFormError("Please select a calculation run.");
      return;
    }
    if (adjustments.length === 0) {
      setFormError("Add at least one adjustment.");
      return;
    }
    setFormError(null);
    setCreating(true);
    setResult(null);

    try {
      const payload = {
        calculationRunId: selectedRunId,
        label: label || "What-if scenario",
        adjustments: adjustments.map((adj) => ({
          ...(adj.scope ? { scope: Number(adj.scope) as 1 | 2 | 3 } : {}),
          ...(adj.categoryId.trim() ? { categoryId: adj.categoryId.trim() } : {}),
          ...(adj.facilityId.trim() ? { facilityId: adj.facilityId.trim() } : {}),
          reductionPercent: adj.reductionPercent,
        })),
      };

      const res = await fetch(`/api/orgs/${orgId}/scenarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormError((err as { message?: string }).message ?? "Failed to create scenario.");
        return;
      }

      const created = (await res.json()) as {
        id: string;
        calculationRunId: string;
        createdAt: string;
        expiresAt: string;
        baselineTotal: number;
        scenarioTotal: number;
        reduction: number;
        reductionPercent: number;
        draftsCount: number;
      };

      // Fetch the full result including scope breakdown
      const detailRes = await fetch(
        `/api/orgs/${orgId}/scenarios/${created.id}`,
      );
      if (detailRes.ok) {
        const detail = await detailRes.json();
        setResult(detail as ScenarioResult);
      }

      fetchPastRuns();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function loadScenario(runId: string) {
    const res = await fetch(`/api/orgs/${orgId}/scenarios/${runId}`);
    if (res.ok) {
      const detail = await res.json();
      setResult(detail as ScenarioResult);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
          <FlaskConical className="h-5 w-5 text-zinc-700" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">What-If Scenarios</h1>
          <p className="text-sm text-zinc-500">
            Model hypothetical emission reductions against a completed calculation run.
          </p>
        </div>
      </div>

      {/* Create scenario form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create Scenario</CardTitle>
          <CardDescription>
            Select a baseline, describe your reduction adjustments, then run the model.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Calculation run selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">
              Baseline calculation run
            </label>
            {loadingRuns ? (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading runs…
              </div>
            ) : calcRuns.length === 0 ? (
              <p className="text-sm text-zinc-400">
                No succeeded calculation runs found. Complete a calculation first.
              </p>
            ) : (
              <select
                value={selectedRunId}
                onChange={(e) => setSelectedRunId(e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                {calcRuns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.reportingPeriod?.label ?? r.id} — {fmtDate(r.createdAt)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Label */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">
              Label <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <Input
              placeholder="e.g. 20% Scope 3 reduction"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          {/* Adjustments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-700">Adjustments</label>
              <Button variant="outline" size="sm" onClick={addAdjustment}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add row
              </Button>
            </div>
            {adjustments.length === 0 && (
              <p className="text-sm text-zinc-400">No adjustments added yet.</p>
            )}
            <div className="space-y-2">
              {adjustments.map((adj, i) => (
                <AdjustmentRow
                  key={i}
                  adj={adj}
                  index={i}
                  onChange={updateAdjustment}
                  onRemove={removeAdjustment}
                />
              ))}
            </div>
          </div>

          {/* Error */}
          {formError && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}

          <Button
            onClick={handleRunScenario}
            disabled={creating || calcRuns.length === 0 || adjustments.length === 0}
            className="w-full sm:w-auto"
          >
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {creating ? "Running…" : "Run Scenario"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Scenario Results</h2>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span>Expires {fmtDate(result.expiresAt)}</span>
              <Badge variant="outline" className="text-xs">
                {result.draftsCount} records
              </Badge>
            </div>
          </div>

          {/* Scope cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                { label: "Scope 1", key: "scope1" },
                { label: "Scope 2", key: "scope2" },
                { label: "Scope 3", key: "scope3" },
                { label: "Total", key: "total" },
              ] as const
            ).map(({ label: cardLabel, key }) => {
              const baselineVal =
                key === "total" ? result.baseline.total : result.baseline[key];
              const scenarioVal =
                key === "total" ? result.scenario.total : result.scenario[key];
              const reductionVal =
                key === "total" ? result.reduction.total : result.reduction[key];
              const reductionPct =
                key === "total"
                  ? result.reduction.totalPercent
                  : baselineVal > 0
                    ? (reductionVal / baselineVal) * 100
                    : 0;
              return (
                <ScopeCard
                  key={key}
                  label={cardLabel}
                  baseline={baselineVal}
                  scenario={scenarioVal}
                  reduction={reductionVal}
                  reductionPercent={reductionPct}
                />
              );
            })}
          </div>

          {/* Top reductions table */}
          {result.topReductions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-zinc-700">
                  Top 10 Biggest Reductions
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Category</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead className="text-right">Baseline</TableHead>
                      <TableHead className="text-right">Scenario</TableHead>
                      <TableHead className="text-right pr-4">Reduction</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.topReductions.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="pl-4">
                          <div className="font-medium text-zinc-900">{row.categoryName}</div>
                          <div className="text-xs text-zinc-400">{row.categoryCode}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            Scope {row.scope}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmt(row.baselineCo2e)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmt(row.scenarioCo2e)}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <span className="inline-flex items-center gap-1 rounded-md bg-green-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-green-800">
                            <TrendingDown className="h-3 w-3" />
                            {fmt(row.reduction)} ({fmtPct(row.reductionPercent)})
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Past scenario runs */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Recent Scenarios</h2>
        {loadingPastRuns ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : pastRuns.length === 0 ? (
          <p className="text-sm text-zinc-400">No scenarios created yet.</p>
        ) : (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Period</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead className="pr-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pastRuns.map((run) => {
                    const expired = isExpired(run.expiresAt);
                    return (
                      <TableRow
                        key={run.id}
                        className={expired ? "opacity-50" : "cursor-pointer hover:bg-zinc-50"}
                        onClick={expired ? undefined : () => loadScenario(run.id)}
                      >
                        <TableCell className="pl-4 font-medium text-zinc-900">
                          {run.calculationRun?.reportingPeriod?.label ?? run.calculationRunId}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-500">
                          {fmtDate(run.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-500">
                          {run.createdBy?.name ?? run.createdBy?.email ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-500">
                          {run._count.drafts}
                        </TableCell>
                        <TableCell className="pr-4">
                          {expired ? (
                            <Badge
                              variant="outline"
                              className="text-xs text-zinc-400 border-zinc-200"
                            >
                              Expired
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs text-green-700 border-green-200 bg-green-50"
                            >
                              Active
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
