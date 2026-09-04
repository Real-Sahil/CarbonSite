"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardList, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Facility { id: string; name: string }
interface Category { id: string; code: string; name: string; scope: number }
interface Member { id: string; name: string | null; email: string }
interface ReportingPeriod { id: string; label: string }

interface MatrixCell {
  facilityId: string;
  emissionCategoryId: string;
  requirementId: string;
  status: "green" | "amber" | "red" | "not_required";
  recordCount: number;
  approvedCount: number;
  owner: Member | null;
  notes: string | null;
}

interface MatrixResponse {
  reportingPeriod: { id: string; label: string };
  facilities: Facility[];
  categories: Category[];
  cells: MatrixCell[];
  summary: { totalRequired: number; green: number; amber: number; red: number; completenessPercent: number };
  setupNeeded: boolean;
}

const STATUS_STYLES: Record<MatrixCell["status"], string> = {
  green: "bg-green-500 hover:bg-green-600",
  amber: "bg-amber-400 hover:bg-amber-500",
  red: "bg-red-500 hover:bg-red-600",
  not_required: "bg-zinc-100",
};

const STATUS_LABEL: Record<MatrixCell["status"], string> = {
  green: "Received and approved",
  amber: "Submitted, not yet approved",
  red: "Missing",
  not_required: "Not required",
};

export function CompletenessMatrixClient({
  orgId,
  canEdit,
  facilities,
  categories,
  members,
  reportingPeriods,
}: {
  orgId: string;
  canEdit: boolean;
  facilities: Facility[];
  categories: Category[];
  members: Member[];
  reportingPeriods: ReportingPeriod[];
}) {
  const [periodId, setPeriodId] = useState(reportingPeriods[0]?.id ?? "");
  const [data, setData] = useState<MatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRequirementForm, setShowRequirementForm] = useState(false);
  const [selectedCell, setSelectedCell] = useState<MatrixCell | null>(null);

  const load = useCallback(async () => {
    if (!periodId) { setLoading(false); return; }
    setLoading(true);
    const res = await fetch(`/api/orgs/${orgId}/completeness/matrix?reportingPeriodId=${periodId}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [orgId, periodId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const cellFor = (facilityId: string, categoryId: string) =>
    data?.cells.find((c) => c.facilityId === facilityId && c.emissionCategoryId === categoryId) ?? null;

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB]">
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0F9FF]">
              <ClipboardList className="h-4 w-4 text-[#111827]" />
            </div>
            <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">Data Quality</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Completeness matrix</h1>
          <p className="mt-1 text-sm text-[#374151] max-w-[65ch]">
            Which facilities have reported each emission category for the selected period, graded against what the
            organisation actually expects to receive.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {reportingPeriods.length > 0 && (
              <Select value={periodId} onValueChange={setPeriodId}>
                <SelectTrigger className="h-9 w-56 text-sm">
                  <SelectValue placeholder="Select reporting period" />
                </SelectTrigger>
                <SelectContent>
                  {reportingPeriods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setShowRequirementForm(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add requirement
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 py-8 flex flex-col gap-6">
        {loading ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : !data || data.setupNeeded ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardList className="mx-auto h-8 w-8 text-zinc-300 mb-3" />
              <p className="text-sm font-medium text-zinc-700">No completeness requirements configured yet</p>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                Add a requirement for each facility x emission category combination you expect data for, with an owner
                responsible for chasing it up.
              </p>
              {canEdit && (
                <Button size="sm" className="mt-4" onClick={() => setShowRequirementForm(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add first requirement
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryStat label="Completeness" value={`${data.summary.completenessPercent.toFixed(0)}%`} />
              <SummaryStat label="Received & approved" value={String(data.summary.green)} tone="text-green-700" />
              <SummaryStat label="Submitted, unreviewed" value={String(data.summary.amber)} tone="text-amber-700" />
              <SummaryStat label="Missing" value={String(data.summary.red)} tone="text-red-700" />
            </div>

            <Card className="border-[#E5E7EB] shadow-none">
              <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
                <CardTitle className="text-sm font-semibold text-zinc-900">{data.reportingPeriod.label}</CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Rows are facilities, columns are emission categories. Grey cells aren&apos;t required for that facility.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto p-6">
                <table className="border-separate border-spacing-1">
                  <thead>
                    <tr>
                      <th className="text-left text-xs font-medium text-zinc-500 pr-3 pb-2 sticky left-0 bg-white">Facility</th>
                      {data.categories.map((cat) => (
                        <th key={cat.id} className="text-xs font-medium text-zinc-500 pb-2 px-1" title={cat.name}>
                          <div className="w-10 truncate">{cat.code}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.facilities.map((facility) => (
                      <tr key={facility.id}>
                        <td className="text-sm text-zinc-700 pr-3 whitespace-nowrap sticky left-0 bg-white">{facility.name}</td>
                        {data.categories.map((cat) => {
                          const cell = cellFor(facility.id, cat.id);
                          if (!cell) return <td key={cat.id} className="w-10 h-8" />;
                          return (
                            <td key={cat.id} className="p-0">
                              <button
                                onClick={() => setSelectedCell(cell)}
                                className={cn(
                                  "w-8 h-8 rounded-md transition-colors",
                                  STATUS_STYLES[cell.status],
                                )}
                                title={`${facility.name} / ${cat.name}: ${STATUS_LABEL[cell.status]}`}
                                aria-label={`${facility.name}, ${cat.name}, ${STATUS_LABEL[cell.status]}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {selectedCell && (
        <CellDetailModal
          cell={selectedCell}
          facilityName={data?.facilities.find((f) => f.id === selectedCell.facilityId)?.name ?? ""}
          categoryName={data?.categories.find((c) => c.id === selectedCell.emissionCategoryId)?.name ?? ""}
          onClose={() => setSelectedCell(null)}
        />
      )}

      {showRequirementForm && (
        <RequirementFormModal
          orgId={orgId}
          facilities={facilities}
          categories={categories}
          members={members}
          onClose={() => setShowRequirementForm(false)}
          onSaved={() => { setShowRequirementForm(false); load(); }}
        />
      )}
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
      <div className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-1">{label}</div>
      <div className={cn("text-2xl font-semibold tabular-nums text-zinc-900", tone)}>{value}</div>
    </div>
  );
}

function CellDetailModal({
  cell, facilityName, categoryName, onClose,
}: {
  cell: MatrixCell; facilityName: string; categoryName: string; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{facilityName}</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs font-medium text-gray-500">Category</p>
            <p className="text-gray-900">{categoryName}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Status</p>
            <p className="text-gray-900">{STATUS_LABEL[cell.status]}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Records this period</p>
            <p className="text-gray-900">{cell.recordCount} total, {cell.approvedCount} approved</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Owner</p>
            <p className="text-gray-900">{cell.owner?.name ?? cell.owner?.email ?? "Unassigned"}</p>
          </div>
          {cell.notes && (
            <div>
              <p className="text-xs font-medium text-gray-500">Notes</p>
              <p className="text-gray-900">{cell.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RequirementFormModal({
  orgId, facilities, categories, members, onClose, onSaved,
}: {
  orgId: string; facilities: Facility[]; categories: Category[]; members: Member[];
  onClose: () => void; onSaved: () => void;
}) {
  const [facilityId, setFacilityId] = useState(facilities[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [ownerUserId, setOwnerUserId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/completeness/requirements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityId,
          emissionCategoryId: categoryId,
          ownerUserId: ownerUserId || undefined,
          required: true,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.message ?? "Could not save requirement.");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Add completeness requirement</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Facility</label>
            <Select value={facilityId} onValueChange={setFacilityId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {facilities.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Emission category</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Owner <span className="text-gray-400">(optional)</span></label>
            <Select value={ownerUserId} onValueChange={setOwnerUserId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name ?? m.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="text-gray-400">(optional)</span></label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 resize-none"
            />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <Button type="submit" disabled={saving || !facilityId || !categoryId}>
            {saving ? "Saving…" : "Add requirement"}
          </Button>
        </form>
      </div>
    </div>
  );
}
