"use client";

import Link from "next/link";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, CheckCircle, XCircle, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormActions, FormDisclosure, FormError, FormField, FormSection } from "@/components/forms/form-kit";

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
    const errorMsg = body?.message ?? `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }
  return res.json();
}

// Per-check fix actions — keyed by check.id, resolved with orgId at render time
type FixAction = { label: string; href: (orgId: string) => string };
const CHECK_FIX_ACTIONS: Record<string, FixAction> = {
  "ghg-scope1":             { label: "Add Scope 1 records",            href: (o) => `/orgs/${o}/records` },
  "ghg-scope2":             { label: "Add Scope 2 records",            href: (o) => `/orgs/${o}/records` },
  "ghg-approved":           { label: "Review pending records",         href: (o) => `/orgs/${o}/records?reviewStatus=in_review` },
  "secr-scope1":            { label: "Add Scope 1 records",            href: (o) => `/orgs/${o}/records` },
  "secr-scope2":            { label: "Add Scope 2 records",            href: (o) => `/orgs/${o}/records` },
  "secr-energy":            { label: "Import energy data",             href: (o) => `/orgs/${o}/imports` },
  "secr-facility":          { label: "Add a facility",                 href: (o) => `/orgs/${o}/settings` },
  "csrd-scope1":            { label: "Add Scope 1 records",            href: (o) => `/orgs/${o}/records` },
  "csrd-scope2":            { label: "Add Scope 2 records",            href: (o) => `/orgs/${o}/records` },
  "csrd-scope3":            { label: "Add Scope 3 records",            href: (o) => `/orgs/${o}/records` },
  "csrd-scope2-market-based": { label: "Add market-based records",     href: (o) => `/orgs/${o}/records` },
  "ppn-scope1":             { label: "Add Scope 1 records",            href: (o) => `/orgs/${o}/records` },
  "ppn-scope2":             { label: "Add Scope 2 records",            href: (o) => `/orgs/${o}/records` },
  "ppn-s3-upstream-transport": { label: "Add upstream transport records", href: (o) => `/orgs/${o}/records` },
  "ppn-s3-business-travel": { label: "Add business travel records",   href: (o) => `/orgs/${o}/records` },
  "ppn-s3-commuting":       { label: "Add commuting records",         href: (o) => `/orgs/${o}/records` },
  "ppn-all-approved":       { label: "Review pending records",         href: (o) => `/orgs/${o}/records?reviewStatus=in_review` },
  "iso-scope1":             { label: "Add Scope 1 records",            href: (o) => `/orgs/${o}/records` },
  "iso-scope2":             { label: "Add Scope 2 records",            href: (o) => `/orgs/${o}/records` },
  "bid-emissions":          { label: "Go to calculations",             href: (o) => `/orgs/${o}/calculations` },
  "bid-base-year":          { label: "Set a base year",                href: (o) => `/orgs/${o}/base-year` },
  "bid-net-zero":           { label: "Set the net zero year in the plan", href: (o) => `/orgs/${o}/carbon-reduction-plan` },
  "bid-signatory":          { label: "Add the director sign-off",      href: (o) => `/orgs/${o}/carbon-reduction-plan` },
  "csrd-materiality":       { label: "Open materiality",               href: (o) => `/orgs/${o}/materiality` },
  "bid-scope3":             { label: "Add Scope 3 records",            href: (o) => `/orgs/${o}/records` },
  "bid-reviewed":           { label: "Review the snapshot",            href: (o) => `/orgs/${o}/calculations` },
  "bid-measures":           { label: "Add reduction measures",         href: (o) => `/orgs/${o}/targets` },
};

// Report types that require a contract selection
const CONTRACT_REQUIRED_TYPES = new Set(["national_toms", "contract_carbon", "site_noticeboard"]);

// Report types that have framework-specific validation rules
const FRAMEWORK_VALIDATED_TYPES = new Set([
  "secr",
  "csrd_esrs_e1",
  "audit_package",
  "inventory",
  "monthly_snapshot",
  "bid_carbon_pack",
]);

const MAX_BID_CONTRACTS = 5;

// The default is the customer-facing GHG Protocol disclosure. Every emissions
// report also ships the CSV calculation trail (every record's factor and
// formula), which is the auditor's appendix.
export const DEFAULT_REPORT_TYPE = "ghg_protocol";

// The three documents most customers need are shown first: the PPN 006
// Carbon Reduction Plan for public tenders, the SECR disclosure for the
// Directors' Report, and the GHG Protocol report. The bid carbon pack joins
// them on plans that include it. Everything else is one click away under
// "Show all report types", so the list is short for someone new to it.
export const CORE_REPORT_TYPES = ["ghg_protocol", "ppn_006_crp", "secr", "bid_carbon_pack"] as const;

const REPORT_TYPE_OPTIONS = [
  { value: "ghg_protocol",     label: "GHG Protocol emissions report (recommended)" },
  { value: "ppn_006_crp",      label: "Carbon Reduction Plan (PPN 006, public tenders)" },
  { value: "secr",             label: "SECR (Directors' Report energy and carbon)" },
  { value: "bid_carbon_pack",  label: "Bid carbon pack (tender evidence)" },
  { value: "sustainability_report", label: "Annual sustainability report" },
  { value: "site_noticeboard", label: "Site noticeboard (one contract)" },
  { value: "site_operations", label: "Site operations (fuel, plant, controlled material, waste documents)" },
  { value: "tcfd_statement", label: "Climate disclosure (TCFD structure)" },
  { value: "transition_plan",  label: "Climate transition plan (ESRS E1-1)" },
  { value: "inventory",        label: "Inventory" },
  { value: "monthly_snapshot", label: "Monthly snapshot" },
  { value: "audit_package",    label: "Audit package" },
  { value: "cdp",              label: "CDP Climate Change (C5, C6, C7)" },
  { value: "nhs_evergreen",    label: "NHS Evergreen Level 1" },
  { value: "breeam_evidence",  label: "BREEAM Evidence Pack" },
  { value: "national_toms",    label: "National TOMS Social Value" },
  { value: "csrd_esrs_e1",     label: "CSRD ESRS E1" },
  { value: "csrd_esrs_e3",     label: "CSRD ESRS E3 (Water)" },
  { value: "csrd_esrs_e5",     label: "CSRD ESRS E5 (Waste & Resources)" },
  { value: "contract_carbon",  label: "Contract Carbon Report" },
  { value: "ecology_survey",  label: "Ecology Survey (BNG/Biodiversity Net Gain)" },
  { value: "ecology_scan",    label: "Ecology Scan (NBN Atlas / MAGIC / FC Woodland)" },
  { value: "ppn_06_21",        label: "PPN 06/21 Carbon Reduction Plan (superseded by PPN 006)" },
];

/** Core types this organisation's plan can generate, in display order. */
export function coreReportTypes(bidPackIncluded: boolean, recommended?: readonly string[]): string[] {
  const known = new Set(REPORT_TYPE_OPTIONS.map((o) => o.value));
  const list = recommended?.length ? recommended.filter((t) => known.has(t)) : CORE_REPORT_TYPES;
  return list.filter((t) => t !== "bid_carbon_pack" || bidPackIncluded);
}

export function CreateReportForm({
  orgId,
  snapshots,
  contracts = [],
  bidPackIncluded = true,
  initialBid,
  recommended,
  recommendedFor,
}: {
  orgId: string;
  snapshots: SnapshotOption[];
  contracts?: ContractOption[];
  /** False on plans without the bid carbon pack; it then moves out of the core list. */
  bidPackIncluded?: boolean;
  /** Prefill for a bid pack, e.g. from a tender on the Tenders page. */
  initialBid?: { bidTitle?: string; buyerName?: string; tenderReference?: string };
  /** Report types that lead the picker for this organisation's country (lib/country/profile.ts). A nudge only: every type stays available. */
  recommended?: readonly string[];
  /** The country name shown in the group label, e.g. "Germany". */
  recommendedFor?: string;
}) {
  const core = coreReportTypes(bidPackIncluded, recommended);
  const [showAll, setShowAll] = useState(false);
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [reportType, setReportType] = useState(initialBid && bidPackIncluded ? "bid_carbon_pack" : DEFAULT_REPORT_TYPE);
  const [snapshotId, setSnapshotId] = useState(snapshots[0]?.id ?? "");
  const [intensityMetricLabel, setIntensityMetricLabel] = useState("");
  const [intensityMetricValue, setIntensityMetricValue] = useState("");
  const [cbamEori, setCbamEori] = useState("");
  const [bid, setBid] = useState({
    bidTitle: initialBid?.bidTitle ?? "",
    buyerName: initialBid?.buyerName ?? "",
    tenderReference: initialBid?.tenderReference ?? "",
    signatoryName: "",
    signatoryTitle: "",
    signatoryDate: "",
    // Empty: the pack uses the net zero year in the Carbon Reduction Plan or transition plan.
    netZeroYear: "",
  });
  const [bidContractIds, setBidContractIds] = useState<string[]>([]);

  // Validation state
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validatedFor, setValidatedFor] = useState<{ snapshotId: string; reportType: string; optionsKey: string } | null>(null);

  const canCreate = snapshots.length > 0;
  const needsContract = CONTRACT_REQUIRED_TYPES.has(reportType);
  const needsValidation = FRAMEWORK_VALIDATED_TYPES.has(reportType);
  const isBidPack = reportType === "bid_carbon_pack";

  // Only the fields the user filled in, so an empty field never overrides a default.
  const bidOptions: Record<string, unknown> = isBidPack
    ? {
        ...Object.fromEntries(Object.entries(bid).filter(([, v]) => v.trim() !== "").map(([k, v]) => [k, k === "netZeroYear" ? Number(v) : v.trim()])),
        ...(bidContractIds.length ? { contractIds: bidContractIds } : {}),
      }
    : {};
  const optionsKey = JSON.stringify(bidOptions);

  // Validation is stale if snapshot, type or bid details changed since last run
  const validationFresh =
    validatedFor?.snapshotId === snapshotId &&
    validatedFor?.reportType === reportType &&
    validatedFor?.optionsKey === optionsKey;

  const canGenerate =
    !needsValidation ||
    (validationFresh && validationResult !== null && validationResult.valid);


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
      const url = `/api/orgs/${orgId}/reports/validate`;
      const payload = { snapshotId, reportType, ...(isBidPack ? { options: bidOptions } : {}) };
      const result = (await postJson(url, payload)) as ValidationResult;
      setValidationResult(result);
      setValidatedFor({ snapshotId, reportType, optionsKey });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Validation failed";
      console.error("[CreateReportForm] Validation error:", errorMsg, err);
      setValidationError(errorMsg);
    } finally {
      setIsValidating(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const sid = form.get("snapshotId") as string;
    const snapshot = snapshots.find((s) => s.id === sid);
    const contractId = form.get("contractId") as string | null;

    startTransition(async () => {
      try {
        const secrOptions =
          reportType === "secr"
            ? {
                ...(intensityMetricLabel.trim() ? { intensityDenominator: intensityMetricLabel.trim() } : {}),
                ...(intensityMetricValue !== "" ? { intensityDenominatorValue: Number(intensityMetricValue) } : {}),
              }
            : {};
        const cbamOptions =
          reportType === "cbam"
            ? { ...(cbamEori.trim() ? { declarantEori: cbamEori.trim() } : {}) }
            : {};
        await postJson(`/api/orgs/${orgId}/reports`, {
          snapshotId: sid,
          reportingPeriodId: snapshot?.reportingPeriodId,
          type: reportType,
          ...(!isBidPack && contractId && contractId !== "" ? { contractId } : {}),
          options: { ...secrOptions, ...cbamOptions, ...bidOptions },
        });
        formEl.reset();
        setReportType(DEFAULT_REPORT_TYPE);
        setBidContractIds([]);
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
      <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-[#E5E7EB] bg-white p-4 sm:p-5">
        <FormSection title="Request a report" description="Reports are built from a published snapshot, so figures match the dashboard.">
          <FormField label="Snapshot" htmlFor="report-snapshot" span={2}>
            <select
              id="report-snapshot"
              name="snapshotId"
              required
              disabled={!canCreate}
              value={snapshotId}
              onChange={(e) => handleSnapshotChange(e.target.value)}
              className={selectClass}
            >
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Report type"
            htmlFor="report-type"
            span={2}
          >
            <select
              id="report-type"
              name="type"
              value={reportType}
              onChange={(e) => handleTypeChange(e.target.value)}
              disabled={!canCreate}
              className={selectClass}
            >
              {showAll || !core.includes(reportType) ? (
                <>
                  <optgroup label={recommendedFor ? `Recommended for ${recommendedFor}` : "Recommended"}>
                    {REPORT_TYPE_OPTIONS.filter((o) => core.includes(o.value)).map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="More frameworks">
                    {REPORT_TYPE_OPTIONS.filter((o) => !core.includes(o.value)).map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                </>
              ) : (
                REPORT_TYPE_OPTIONS.filter((o) => core.includes(o.value)).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-xs font-medium text-[#c2410c] hover:underline"
              aria-expanded={showAll}
            >
              {showAll ? "Show recommended only" : `Show all report types (${REPORT_TYPE_OPTIONS.length})`}
            </button>
          </FormField>

          {isBidPack ? null : needsContract ? (
            <FormField label="Contract" htmlFor="report-contract" span={2}>
              <select id="report-contract" name="contractId" required disabled={!canCreate || contracts.length === 0} className={selectClass}>
                <option value="">Select contract…</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FormField>
          ) : (
            <FormField label="Contract" htmlFor="report-contract" span={2} optional>
              <select id="report-contract" name="contractId" disabled={!canCreate || contracts.length === 0} className={selectClass}>
                <option value="">All contracts</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FormField>
          )}
        </FormSection>

        {!canCreate && <p className="text-sm text-[#374151]">Publish a calculation snapshot before requesting a report.</p>}
        {needsContract && contracts.length === 0 && (
          <p className="text-sm text-[#374151]">Create contracts first to generate National TOMS or Contract Carbon reports.</p>
        )}
        {needsValidation && !validationFresh && !isValidating && (
          <p className="text-sm text-[#374151]">
            Click <strong>Validate</strong> to check {isBidPack ? "the pack is ready for a tender" : "framework requirements"} before generating.
          </p>
        )}
        <FormError>{submitError}</FormError>

        <FormActions>
          {needsValidation && (
            <Button type="button" variant="outline" size="sm" disabled={!canCreate || isValidating} onClick={handleValidate}>
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking…
                </>
              ) : (
                "Validate"
              )}
            </Button>
          )}
          <Button type="submit" size="sm" disabled={!canCreate || isPending || (needsValidation && !canGenerate)}>
            <Plus className="h-4 w-4" />
            {isPending ? "Requesting…" : "Request report"}
          </Button>
        </FormActions>
      </form>

      {reportType === "ppn_006_crp" && (
        <div className="rounded-[14px] border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-sm text-[#7c2d12]">
          For a complete plan with your boundary, baseline rationale, targets, reduction projects and director sign-off, use the{" "}
          <Link href={`/orgs/${orgId}/carbon-reduction-plan`} className="font-medium underline">
            guided Carbon Reduction Plan
          </Link>
          . Generating here prints figures only.
        </div>
      )}

      {reportType === "secr" && (
        <FormDisclosure title="SECR intensity metrics">
          <FormField label="Intensity denominator" htmlFor="secr-label" span={2} optional hint="For example employee, £m turnover, tonne output">
            <input id="secr-label" type="text" value={intensityMetricLabel} onChange={(e) => setIntensityMetricLabel(e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Denominator for the period" htmlFor="secr-value" span={2} optional>
            <input id="secr-value" type="number" step="any" min="0" value={intensityMetricValue} onChange={(e) => setIntensityMetricValue(e.target.value)} className={inputClass} />
          </FormField>
        </FormDisclosure>
      )}

      {isBidPack && (
        <div className="space-y-6 rounded-lg border border-[#E5E7EB] bg-white p-4 sm:p-5">
          <FormSection title="The bid" description="Figures come from the snapshot above and earlier published snapshots. Buyer and reference are optional.">
            <FormField label="Bid or project name" htmlFor="bid-title" span={2}>
              <input id="bid-title" type="text" maxLength={200} value={bid.bidTitle} onChange={(e) => setBid({ ...bid, bidTitle: e.target.value })} placeholder="Highways maintenance framework" className={inputClass} />
            </FormField>
            <FormField label="Buyer" htmlFor="bid-buyer">
              <input id="bid-buyer" type="text" maxLength={200} value={bid.buyerName} onChange={(e) => setBid({ ...bid, buyerName: e.target.value })} className={inputClass} />
            </FormField>
            <FormField label="Tender reference" htmlFor="bid-reference">
              <input id="bid-reference" type="text" maxLength={100} value={bid.tenderReference} onChange={(e) => setBid({ ...bid, tenderReference: e.target.value })} className={inputClass} />
            </FormField>
          </FormSection>

          <FormSection title="Sign-off" description="A director confirms the pack before it goes out. All optional until you validate.">
            <FormField label="Director" htmlFor="bid-signatory">
              <input id="bid-signatory" type="text" maxLength={120} value={bid.signatoryName} onChange={(e) => setBid({ ...bid, signatoryName: e.target.value })} className={inputClass} />
            </FormField>
            <FormField label="Position" htmlFor="bid-signatory-title">
              <input id="bid-signatory-title" type="text" maxLength={120} value={bid.signatoryTitle} onChange={(e) => setBid({ ...bid, signatoryTitle: e.target.value })} placeholder="Managing Director" className={inputClass} />
            </FormField>
            <FormField label="Sign-off date" htmlFor="bid-signatory-date">
              <input id="bid-signatory-date" type="date" value={bid.signatoryDate} onChange={(e) => setBid({ ...bid, signatoryDate: e.target.value })} className={inputClass} />
            </FormField>
            <FormField label="Net zero year" htmlFor="bid-net-zero" hint="Defaults to your Carbon Reduction Plan">
              <input id="bid-net-zero" type="number" min={2025} max={2050} value={bid.netZeroYear} onChange={(e) => setBid({ ...bid, netZeroYear: e.target.value })} className={inputClass} />
            </FormField>
          </FormSection>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-zinc-900">Comparable contracts</legend>
            <p className="text-xs text-zinc-500">Feature up to {MAX_BID_CONTRACTS} to show delivery evidence.</p>
            {contracts.length === 0 ? (
              <p className="text-sm text-[#374151]">No contracts yet. Add contracts to show delivery evidence.</p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {contracts.map((c) => {
                  const checked = bidContractIds.includes(c.id);
                  const full = !checked && bidContractIds.length >= MAX_BID_CONTRACTS;
                  return (
                    <label key={c.id} className={`flex items-center gap-2 text-sm ${full ? "text-[#6B7280]" : "text-[#111827]"}`}>
                      <input
                        id={`bid-contract-${c.id}`}
                        type="checkbox"
                        checked={checked}
                        disabled={full}
                        onChange={(e) =>
                          setBidContractIds((ids) => (e.target.checked ? [...ids, c.id] : ids.filter((id) => id !== c.id)))
                        }
                      />
                      {c.name}
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>
        </div>
      )}

      {reportType === "cbam" && (
        <FormDisclosure title="CBAM declarant details">
          <FormField label="Declarant EORI number" htmlFor="cbam-eori" span={2} optional hint="Required for the final EU CBAM submission. The report generates without it.">
            <input id="cbam-eori" type="text" value={cbamEori} onChange={(e) => setCbamEori(e.target.value)} placeholder="GB123456789000" maxLength={17} className={inputClass} />
          </FormField>
        </FormDisclosure>
      )}

      {/* Validation results panel */}
      {(validationResult || validationError) && validationFresh && (
        <ValidationResults
          result={validationResult}
          error={validationError}
          orgId={orgId}
        />
      )}
    </div>
  );
}

function ValidationResults({
  result,
  error,
  orgId,
}: {
  result: ValidationResult | null;
  error: string | null;
  orgId: string;
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
          ? "border-[#FED7AA] bg-[#FFF7ED]"
          : "border-red-200 bg-red-50"
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        {result.valid ? (
          <>
            <CheckCircle className="h-4 w-4 text-[#111827] shrink-0" />
            <p className="text-sm font-medium text-[#111827]">
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

      <ul className="flex flex-col gap-2.5">
        {result.checks.map((item) => {
          const fix = !item.passed ? CHECK_FIX_ACTIONS[item.check.id] : null;
          return (
            <li key={item.check.id} className="flex items-start gap-2 text-sm">
              {item.passed ? (
                <CheckCircle className="h-4 w-4 text-[#111827] shrink-0 mt-0.5" />
              ) : item.check.required ? (
                <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <span
                  className={
                    item.passed
                      ? "text-[#111827]"
                      : item.check.required
                        ? "text-red-700"
                        : "text-amber-700"
                  }
                >
                  {item.check.description}
                </span>
                {!item.passed && item.message && (
                  <p className="mt-0.5 text-xs text-[#374151]">{item.message}</p>
                )}
                {item.passed && !item.check.required && item.message && (
                  <p className="mt-0.5 text-xs text-[#374151]">{item.message}</p>
                )}
                {fix && (
                  <a
                    href={fix.href(orgId)}
                    className={`mt-1.5 inline-flex items-center gap-1 text-xs font-medium rounded-md px-2 py-1 transition-colors ${
                      item.check.required
                        ? "bg-red-100 text-red-700 hover:bg-red-200"
                        : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    }`}
                  >
                    {fix.label}
                    <ArrowRight className="h-3 w-3" />
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const inputClass =
  "h-9 w-full rounded-[8px] border border-[#E5E7EB] bg-white px-3 text-sm placeholder:text-[#9CA3AF] hover:border-[#D1D5DB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50";

const selectClass =
  "h-9 w-full rounded-[8px] border border-[#E5E7EB] bg-white px-3 text-sm hover:border-[#D1D5DB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 disabled:cursor-not-allowed disabled:opacity-50";
