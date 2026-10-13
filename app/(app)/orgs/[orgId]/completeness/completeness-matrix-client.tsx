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
  not_required: "bg-[#F9FAFC]",
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showRequirementForm, setShowRequirementForm] = useState(false);
  const [selectedCell, setSelectedCell] = useState<MatrixCell | null>(null);

  const load = useCallback(async () => {
    if (!periodId) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/completeness/matrix?reportingPeriodId=${periodId}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setLoadError(d.message ?? "Could not load the completeness matrix.");
        setData(null);
        return;
      }
      setData(await res.json());
    } catch {
      setLoadError("Could not reach the server. Check your connection and try again.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [orgId, periodId]);

   
  useEffect(() => { load(); }, [load]);

  const cellFor = (facilityId: string, categoryId: string) =>
    data?.cells.find((c) => c.facilityId === facilityId && c.emissionCategoryId === categoryId) ?? null;

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFC]">
      <div className="bg-white border-b border-[#E3E8EE]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF7ED]">
              <ClipboardList className="h-4 w-4 text-[#131d29]" />
            </div>
            <span className="text-xs font-medium tracking-wide text-[#131d29] uppercase">Data Quality</span>
          </div>
          <h1 className="text-2xl tracking-tight text-[#131d29]">Completeness matrix</h1>
          <p className="mt-1 text-sm text-[#41505F] max-w-[65ch]">
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

      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">
        {loading ? (
          <p className="text-sm text-[#5B6A78]">Loading…</p>
        ) : loadError ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm font-medium text-red-600">{loadError}</p>
              <Button size="sm" variant="outline" className="mt-4" onClick={load}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : !data || data.setupNeeded ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardList className="mx-auto h-8 w-8 text-[#5B6A78] mb-3" />
              <p className="text-sm font-medium text-[#41505F]">No completeness requirements configured yet</p>
              <p className="text-xs text-[#5B6A78] mt-1 max-w-sm mx-auto">
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

            <Card className="border-[#E3E8EE] shadow-none">
              <CardHeader className="px-6 py-4 border-b border-[#E3E8EE]">
                <CardTitle className="text-sm font-semibold text-[#131d29]">{data.reportingPeriod.label}</CardTitle>
                <CardDescription className="text-xs text-[#5B6A78]">
                  Rows are facilities, columns are emission categories. Grey cells aren&apos;t required for that facility.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto p-6">
                <table className="border-separate border-spacing-1">
                  <thead>
                    <tr>
                      <th className="text-left text-xs font-medium text-[#5B6A78] pr-3 pb-2 sticky left-0 bg-white">Facility</th>
                      {data.categories.map((cat) => (
                        <th key={cat.id} className="text-xs font-medium text-[#5B6A78] pb-2 px-1" title={cat.name}>
                          <div className="w-10 truncate">{cat.code}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.facilities.map((facility) => (
                      <tr key={facility.id}>
                        <td className="text-sm text-[#41505F] pr-3 whitespace-nowrap sticky left-0 bg-white">{facility.name}</td>
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
    <div className="rounded-xl border border-[#E3E8EE] bg-white p-5">
      <div className="text-xs font-medium text-[#5B6A78] uppercase tracking-widest mb-1">{label}</div>
      <div className={cn("text-2xl font-semibold tabular-nums text-[#131d29]", tone)}>{value}</div>
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
          <h2 className="text-base font-semibold text-[#131d29]">{facilityName}</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-[#F9FAFC] flex items-center justify-center">
            <X className="h-4 w-4 text-[#5B6A78]" />
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs font-medium text-[#5B6A78]">Category</p>
            <p className="text-[#131d29]">{categoryName}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#5B6A78]">Status</p>
            <p className="text-[#131d29]">{STATUS_LABEL[cell.status]}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#5B6A78]">Records this period</p>
            <p className="text-[#131d29]">{cell.recordCount} total, {cell.approvedCount} approved</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#5B6A78]">Owner</p>
            <p className="text-[#131d29]">{cell.owner?.name ?? cell.owner?.email ?? "Unassigned"}</p>
          </div>
          {cell.notes && (
            <div>
              <p className="text-xs font-medium text-[#5B6A78]">Notes</p>
              <p className="text-[#131d29]">{cell.notes}</p>
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
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#131d29]">Add completeness requirement</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-[#F9FAFC] flex items-center justify-center">
            <X className="h-4 w-4 text-[#5B6A78]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-[#41505F] mb-1">Facility</label>
            <Select value={facilityId} onValueChange={setFacilityId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {facilities.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#41505F] mb-1">Emission category</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#41505F] mb-1">Owner <span className="text-[#5B6A78]">(optional)</span></label>
            <Select value={ownerUserId} onValueChange={setOwnerUserId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name ?? m.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#41505F] mb-1">Notes <span className="text-[#5B6A78]">(optional)</span></label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-[#E3E8EE] bg-white px-3 py-2 text-sm text-[#131d29] outline-none focus:border-[#c2400c] focus:ring-2 focus:ring-[#c2400c]/40 resize-none"
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
