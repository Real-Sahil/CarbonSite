"use client";

import { FormEvent, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
}

// Report types that require a contract selection
const CONTRACT_REQUIRED_TYPES = new Set(["national_toms", "contract_carbon"]);

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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [reportType, setReportType] = useState("inventory");
  const canCreate = snapshots.length > 0;
  const needsContract = CONTRACT_REQUIRED_TYPES.has(reportType);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const snapshotId = form.get("snapshotId") as string;
    const snapshot = snapshots.find((s) => s.id === snapshotId);
    const contractId = form.get("contractId") as string | null;

    startTransition(async () => {
      try {
        await postJson(`/api/orgs/${orgId}/reports`, {
          snapshotId,
          reportingPeriodId: snapshot?.reportingPeriodId,
          type: reportType,
          ...(contractId && contractId !== "" ? { contractId } : {}),
        });
        (event.target as HTMLFormElement).reset();
        setReportType("inventory");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not request report");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-[14px] border border-[#e5e7eb] p-4 lg:grid-cols-[1fr_1fr_1fr_auto]"
    >
      <Field label="Snapshot" className="lg:col-span-1">
        <select
          name="snapshotId"
          required
          disabled={!canCreate}
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
          onChange={(e) => setReportType(e.target.value)}
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

      <div className="flex items-end">
        <Button type="submit" disabled={!canCreate || isPending} className="w-full">
          <Plus className="h-4 w-4" />
          Request
        </Button>
      </div>

      {!canCreate && (
        <p className="text-sm text-[#222222] lg:col-span-4">
          Publish a calculation snapshot before requesting a report.
        </p>
      )}
      {needsContract && contracts.length === 0 && (
        <p className="text-sm text-[#222222] lg:col-span-4">
          Create contracts first to generate National TOMS or Contract Carbon reports.
        </p>
      )}
      {error && <p className="text-sm text-red-600 lg:col-span-4">{error}</p>}
    </form>
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
