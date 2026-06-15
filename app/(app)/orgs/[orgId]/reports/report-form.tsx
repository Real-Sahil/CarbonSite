"use client";

import { FormEvent, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, CheckCircle, XCircle, AlertCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type SnapshotOption = {
  id: string;
  reportingPeriodId: string;
  label: string;
};

type ContractOption = {
  id: string;
  name: string;
};

type FrameworkCheck = {
  id: string;
  description: string;
  required: boolean;
};

type FrameworkCheckResult = {
  check: FrameworkCheck;
  passed: boolean;
  message?: string;
};

type ValidationResult = {
  valid: boolean;
  checks: FrameworkCheckResult[];
  blockingFailures: FrameworkCheckResult[];
};

async function postJson(url: string, payload: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? "Request failed");
  }
  return res.json();
}

// Report types that require a contract selection
const CONTRACT_REQUIRED_TYPES = new Set(["national_toms", "contract_carbon"]);

// Report types that have framework-specific validation rules
const FRAMEWORK_VALIDATED_TYPES = new Set([
  "secr",
  "csrd_esrs_e1",
  "audit_package",
  "inventory",
  "monthly_snapshot",
]);

const REPORT_TYPE_OPTIONS = [
  { value: "inventory",        label: "Inventory" },
  { value: "monthly_snapshot", label: "Monthly snapshot" },
  { value: "audit_package",    label: "Audit package" },
  { value: "secr",             label: "SECR (Streamlined Energy & Carbon)" },
  { value: "ppn_06_21",        label: "PPN 06/21 Carbon Reduction Plan" },
  { value: "nhs_evergreen",    label: "NHS Evergreen Level 1" },
  { value: "breeam_evidence",  label: "BREEAM Evidence Pack" },
  { value: "national_toms",    label: "National TOMS Social Value" },
  { value: "csrd_esrs_e1",     label: "CSRD ESRS E1" },
  { value: "contract_carbon",  label: "Contract Carbon Report" },
];

export function CreateReportForm({
  orgId,
  snapshots,
  contracts = [],
}: {
  orgId: string;
  snapshots: SnapshotOption[];
  contracts?: ContractOption[];
}) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [reportType, setReportType] = useState("inventory");
  const [snapshotId, setSnapshotId] = useState(snapshots[0]?.id ?? "");
  const [secrOpen, setSecrOpen] = useState(false);
  const [intensityMetricLabel, setIntensityMetricLabel] = useState("");
  const [intensityMetricValue, setIntensityMetricValue] = useState("");

  // Validation state
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validatedFor, setValidatedFor] = useState<{ snapshotId: string; reportType: string } | null>(null);

  const canCreate = snapshots.length > 0;
  const needsContract = CONTRACT_REQUIRED_TYPES.has(reportType);
  const needsValidation = FRAMEWORK_VALIDATED_TYPES.has(reportType);

  // Validation is stale if snapshot or type changed since last run
  const validationFresh =
    validatedFor?.snapshotId === snapshotId && validatedFor?.reportType === reportType;

  const canGenerate =
    !needsValidation ||
    (validationFresh && validationResult !== null && validationResult.valid);

  // Show the generate button when: no validation needed, OR validation passed
  const showGenerate = !needsValidation || (validationFresh && validationResult?.valid);

  function handleTypeChange(newType: string) {
    setReportType(newType);
    // Invalidate previous validation when type changes
    if (validatedFor?.reportType !== newType) {
      setValidationResult(null);
      setValidationError(null);
    }
  }

  function handleSnapshotChange(newId: string) {
    setSnapshotId(newId);
    // Invalidate previous validation when snapshot changes
    if (validatedFor?.snapshotId !== newId) {
      setValidationResult(null);
      setValidationError(null);
    }
  }

  async function handleValidate() {
    if (!snapshotId) return;
    setIsValidating(true);
    setValidationError(null);
    setValidationResult(null);
    try {
      const result = (await postJson(`/api/orgs/${orgId}/reports/validate`, {
        snapshotId,
        reportType,
      })) as ValidationResult;
      setValidationResult(result);
      setValidatedFor({ snapshotId, reportType });
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setIsValidating(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    const form = new FormData(event.currentTarget);
    const sid = form.get("snapshotId") as string;
    const snapshot = snapshots.find((s) => s.id === sid);
    const contractId = form.get("contractId") as string | null;

    startTransition(async () => {
      try {
        const secrOptions =
          reportType === "secr"
            ? {
                ...(intensityMetricLabel ? { intensityMetricLabel } : {}),
                ...(intensityMetricValue !== "" ? { intensityMetricValue: Number(intensityMetricValue) } : {}),
              }
            : {};
        await postJson(`/api/orgs/${orgId}/reports`, {
          snapshotId: sid,
          reportingPeriodId: snapshot?.reportingPeriodId,
          type: reportType,
          ...(contractId && contractId !== "" ? { contractId } : {}),
          options: { ...secrOptions },
        });
        (event.target as HTMLFormElement).reset();
        setReportType("inventory");
        setSnapshotId(snapshots[0]?.id ?? "");
        setValidationResult(null);
        setValidatedFor(null);
        router.refresh();
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Could not request report");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-[14px] border border-[#e5e7eb] p-4 lg:grid-cols-[1fr_1fr_1fr_auto_auto]"
      >
        <Field label="Snapshot" className="lg:col-span-1">
          <select
            name="snapshotId"
            required
            disabled={!canCreate}
            value={snapshotId}
            onChange={(e) => handleSnapshotChange(e.target.value)}
            className={selectClass}
          >
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Report type">
          <select
            name="type"
            value={reportType}
            onChange={(e) => handleTypeChange(e.target.value)}
            disabled={!canCreate}
            className={selectClass}
          >
            {REPORT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        {needsContract ? (
          <Field label="Contract (required)">
            <select name="contractId" required={needsContract} disabled={!canCreate || contracts.length === 0} className={selectClass}>
              <option value="">Select contract…</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Contract (optional)">
            <select name="contractId" disabled={!canCreate || contracts.length === 0} className={selectClass}>
              <option value="">All contracts</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        )}

        {/* Validate button — shown for framework-validated types */}
        {needsValidation && (
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              disabled={!canCreate || isValidating}
              onClick={handleValidate}
              className="w-full"
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking…
                </>
              ) : (
                "Validate"
              )}
            </Button>
          </div>
        )}

        {/* Generate / Request button */}
        <div className="flex items-end">
          <Button
            type="submit"
            disabled={!canCreate || isPending || (needsValidation && !canGenerate)}
            className="w-full"
          >
            <Plus className="h-4 w-4" />
            {isPending ? "Requesting…" : "Request"}
          </Button>
        </div>

        {!canCreate && (
          <p className="text-sm text-[#222222] lg:col-span-5">
            Publish a calculation snapshot before requesting a report.
          </p>
        )}
        {needsContract && contracts.length === 0 && (
          <p className="text-sm text-[#222222] lg:col-span-5">
            Create contracts first to generate National TOMS or Contract Carbon reports.
          </p>
        )}
        {needsValidation && !validationFresh && !isValidating && (
          <p className="text-sm text-[#222222] lg:col-span-5">
            Click <strong>Validate</strong> to check framework requirements before generating.
          </p>
        )}
        {submitError && <p className="text-sm text-red-600 lg:col-span-5">{submitError}</p>}
      </form>

      {/* SECR intensity metrics collapsible */}
      {reportType === "secr" && (
        <div className="rounded-[14px] border border-[#e5e7eb]">
          <button
            type="button"
            onClick={() => setSecrOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-normal text-[#0f3e17] tracking-[-0.42px] hover:bg-[#f9fafb] rounded-[14px]"
          >
            <span>SECR intensity metrics</span>
            {secrOpen ? (
              <ChevronUp className="h-4 w-4 text-[#333333]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[#333333]" />
            )}
          </button>
          {secrOpen && (
            <div className="grid gap-4 border-t border-[#e5e7eb] px-4 pb-4 pt-4 sm:grid-cols-2">
              <Field label="Intensity metric label">
                <input
                  type="text"
                  value={intensityMetricLabel}
                  onChange={(e) => setIntensityMetricLabel(e.target.value)}
                  placeholder="e.g. per £m revenue, per FTE, per tonne output"
                  className="h-9 w-full rounded-md border border-[#e5e7eb] bg-[#fffefc] px-3 text-sm shadow-sm placeholder:text-[#999]"
                />
              </Field>
              <Field label="Intensity ratio (tCO₂e per unit)">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={intensityMetricValue}
                  onChange={(e) => setIntensityMetricValue(e.target.value)}
                  placeholder="0.00"
                  className="h-9 w-full rounded-md border border-[#e5e7eb] bg-[#fffefc] px-3 text-sm shadow-sm placeholder:text-[#999]"
                />
              </Field>
            </div>
          )}
        </div>
      )}

      {/* Validation results panel */}
      {(validationResult || validationError) && validationFresh && (
        <ValidationResults
          result={validationResult}
          error={validationError}
        />
      )}
    </div>
  );
}

function ValidationResults({
  result,
  error,
}: {
  result: ValidationResult | null;
  error: string | null;
}) {
  if (error) {
    return (
      <div className="rounded-[14px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="font-medium">Validation error</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div
      className={`rounded-[14px] border p-4 ${
        result.valid
          ? "border-[#b6ced5] bg-[#e1f4df]"
          : "border-red-200 bg-red-50"
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        {result.valid ? (
          <>
            <CheckCircle className="h-4 w-4 text-[#0f3e17] shrink-0" />
            <p className="text-sm font-medium text-[#0f3e17]">
              All required checks passed — ready to generate
            </p>
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4 text-red-600 shrink-0" />
            <p className="text-sm font-medium text-red-700">
              {result.blockingFailures.length} required{" "}
              {result.blockingFailures.length === 1 ? "check" : "checks"} failed
            </p>
          </>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {result.checks.map((item) => (
          <li key={item.check.id} className="flex items-start gap-2 text-sm">
            {item.passed ? (
              <CheckCircle className="h-4 w-4 text-[#0f3e17] shrink-0 mt-0.5" />
            ) : item.check.required ? (
              <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <span
                className={
                  item.passed
                    ? "text-[#0f3e17]"
                    : item.check.required
                      ? "text-red-700"
                      : "text-amber-700"
                }
              >
                {item.check.description}
              </span>
              {item.message && !item.passed && (
                <p className="mt-0.5 text-xs text-[#333333]">{item.message}</p>
              )}
              {item.message && item.passed && !item.check.required && (
                <p className="mt-0.5 text-xs text-[#333333]">{item.message}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-normal text-[#333333] tracking-[-0.36px]">
        {label}
      </Label>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

const selectClass =
  "h-9 w-full rounded-md border border-[#e5e7eb] bg-[#fffefc] px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50";
