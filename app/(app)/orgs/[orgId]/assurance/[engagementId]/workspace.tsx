"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, Plus, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Engagement {
  id: string;
  providerName: string;
  leadAssurorName: string;
  standard: string;
  level: string;
  status: string;
  reportingPeriodLabel: string;
  materialityThresholdCo2e: number | null;
  materialityThresholdPercent: number | null;
  opinionSummary: string | null;
  opinionIssuedAt: string | null;
}

interface EvidenceRequest {
  id: string;
  reference: string;
  description: string;
  status: string;
  dueOn: string | null;
  owner: string | null;
  unavailabilityReason: string | null;
}

interface Sample {
  id: string;
  samplingMethod: string;
  selectionRationale: string;
  testProcedure: string;
  result: string;
  testNotes: string | null;
  sourceDescription: string | null;
  dataOrigin: string | null;
  totalCo2e: number | null;
}

interface Finding {
  id: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  quantifiedImpactCo2e: number | null;
  managementResponse: string | null;
  raisedBy: string;
}

const TABS = ["Evidence", "Samples", "Findings"] as const;
type Tab = (typeof TABS)[number];

export function EngagementWorkspace({
  orgId,
  canManage,
  canRespond,
  readiness,
  engagement,
  evidenceRequests,
  samples,
  findings,
}: {
  orgId: string;
  canManage: boolean;
  canRespond: boolean;
  readiness: { canSignOff: boolean; blockers: string[] };
  engagement: Engagement;
  evidenceRequests: EvidenceRequest[];
  samples: Sample[];
  findings: Finding[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Evidence");
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = engagement.status !== "signed" && engagement.status !== "withdrawn";

  async function signOff() {
    setError(null);
    setSigning(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/assurance/engagements/${engagement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "signed" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Could not sign off the engagement.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSigning(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">{engagement.providerName}</CardTitle>
              <CardDescription>
                {engagement.reportingPeriodLabel} · {engagement.level} assurance under{" "}
                {engagement.standard} · Lead: {engagement.leadAssurorName}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs capitalize">
              {engagement.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-6 text-sm">
            <span className="text-zinc-500">
              Materiality:{" "}
              <span className="font-medium text-zinc-900">
                {engagement.materialityThresholdPercent !== null
                  ? `${engagement.materialityThresholdPercent}%`
                  : engagement.materialityThresholdCo2e !== null
                    ? `${engagement.materialityThresholdCo2e} tCO2e`
                    : "Not set"}
              </span>
            </span>
          </div>

          {engagement.status === "signed" ? (
            <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              <p className="text-sm leading-relaxed text-green-900">
                Opinion issued{" "}
                {engagement.opinionIssuedAt &&
                  new Date(engagement.opinionIssuedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                . {engagement.opinionSummary}
              </p>
            </div>
          ) : (
            canManage && (
              <div className="space-y-2">
                {readiness.canSignOff ? (
                  <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <p className="text-sm text-green-900">
                      Ready to sign off: every significant finding is resolved and every evidence
                      request is settled.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div className="text-sm text-amber-900">
                      {readiness.blockers.map((b, i) => (
                        <p key={i}>{b}</p>
                      ))}
                    </div>
                  </div>
                )}
                {error && (
                  <p className="flex items-center gap-2 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </p>
                )}
                <Button size="sm" onClick={signOff} disabled={!readiness.canSignOff || signing}>
                  {signing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign off engagement
                </Button>
              </div>
            )
          )}
        </CardContent>
      </Card>

      <div className="flex gap-1 border-b border-zinc-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === t ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-700",
            )}
          >
            {t}{" "}
            <span className="text-zinc-400">
              ({t === "Evidence" ? evidenceRequests.length : t === "Samples" ? samples.length : findings.length})
            </span>
          </button>
        ))}
      </div>

      {tab === "Evidence" && (
        <EvidenceTab orgId={orgId} engagementId={engagement.id} items={evidenceRequests} canManage={canManage && isOpen} />
      )}
      {tab === "Samples" && (
        <SamplesTab orgId={orgId} engagementId={engagement.id} items={samples} canManage={canManage && isOpen} />
      )}
      {tab === "Findings" && (
        <FindingsTab
          orgId={orgId}
          engagementId={engagement.id}
          items={findings}
          canManage={canManage && isOpen}
          canRespond={canRespond && isOpen}
        />
      )}
    </div>
  );
}

// ─── Evidence tab ───────────────────────────────────────────────────────────

function EvidenceTab({
  orgId,
  engagementId,
  items,
  canManage,
}: {
  orgId: string;
  engagementId: string;
  items: EvidenceRequest[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  async function add() {
    if (!reference.trim() || !description.trim()) {
      setError("Reference and description are both required.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/assurance/engagements/${engagementId}/evidence-requests`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference: reference.trim(), description: description.trim() }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Could not add the evidence request.");
        return;
      }
      setReference("");
      setDescription("");
      setAdding(false);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    setStatusError(null);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/assurance/engagements/${engagementId}/evidence-requests/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setStatusError(body.message ?? "Could not update the evidence request status.");
        return;
      }
      router.refresh();
    } catch {
      setStatusError("Network error. Try again.");
    }
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          {adding ? (
            <div className="w-full space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <Input placeholder="Reference, e.g. PBC-01" value={reference} onChange={(e) => setReference(e.target.value)} className="sm:col-span-1" />
                <Input placeholder="What is being requested" value={description} onChange={(e) => setDescription(e.target.value)} className="sm:col-span-2" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={add} disabled={busy}>
                  {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Add
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Request evidence
            </Button>
          )}
        </div>
      )}

      {statusError && <p className="text-sm text-red-600">{statusError}</p>}

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-zinc-500">No evidence requests yet.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="pr-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-4 font-medium text-zinc-900">{item.reference}</TableCell>
                    <TableCell className="max-w-[36ch] text-sm text-zinc-600">{item.description}</TableCell>
                    <TableCell className="text-sm text-zinc-500">{item.owner ?? "Unassigned"}</TableCell>
                    <TableCell className="pr-4">
                      {canManage ? (
                        <select
                          value={item.status}
                          onChange={(e) => updateStatus(item.id, e.target.value)}
                          className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                        >
                          <option value="requested">Requested</option>
                          <option value="provided">Provided</option>
                          <option value="not_available">Not available</option>
                          <option value="not_applicable">Not applicable</option>
                        </select>
                      ) : (
                        <Badge variant="outline" className="text-xs capitalize">
                          {item.status.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Samples tab ────────────────────────────────────────────────────────────

function SamplesTab({
  orgId,
  engagementId,
  items,
  canManage,
}: {
  orgId: string;
  engagementId: string;
  items: Sample[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/assurance/engagements/${engagementId}/samples`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetSampleSize: 25 }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Could not generate a sampling plan.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function recordResult(id: string, result: string) {
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/assurance/samples/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Could not record the sample result.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    }
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            Generates a stratified sample: everything above materiality in full, then the weakest
            data provenance tiers, then a random top-up.
          </p>
          <Button size="sm" variant="outline" onClick={generate} disabled={generating}>
            {generating && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Generate sampling plan
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-zinc-500">No samples selected yet.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Item</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Rationale</TableHead>
                  <TableHead className="pr-4">Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="pl-4">
                      <div className="font-medium text-zinc-900">
                        {s.sourceDescription ?? "Activity record"}
                      </div>
                      {s.totalCo2e !== null && (
                        <div className="text-xs text-zinc-400">
                          {s.totalCo2e.toFixed(2)} tCO2e{s.dataOrigin ? ` · ${s.dataOrigin}` : ""}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {s.samplingMethod.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[32ch] text-xs leading-relaxed text-zinc-500">
                      {s.selectionRationale}
                    </TableCell>
                    <TableCell className="pr-4">
                      {canManage ? (
                        <select
                          value={s.result}
                          onChange={(e) => recordResult(s.id, e.target.value)}
                          className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                        >
                          <option value="pending">Pending</option>
                          <option value="pass">Pass</option>
                          <option value="exception_resolved">Exception resolved</option>
                          <option value="fail">Fail</option>
                        </select>
                      ) : (
                        <Badge variant="outline" className="text-xs capitalize">
                          {s.result.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Findings tab ───────────────────────────────────────────────────────────

function FindingsTab({
  orgId,
  engagementId,
  items,
  canManage,
  canRespond,
}: {
  orgId: string;
  engagementId: string;
  items: Finding[];
  canManage: boolean;
  canRespond: boolean;
}) {
  const router = useRouter();
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [busy, setBusy] = useState(false);
  const [raising, setRaising] = useState(false);
  const [severity, setSeverity] = useState("minor");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [raiseError, setRaiseError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function raiseFinding() {
    if (!title.trim() || !description.trim()) {
      setRaiseError("Title and description are both required.");
      return;
    }
    setRaiseError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/assurance/engagements/${engagementId}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ severity, title: title.trim(), description: description.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setRaiseError(body.message ?? "Could not raise the finding.");
        return;
      }
      setTitle("");
      setDescription("");
      setRaising(false);
      router.refresh();
    } catch {
      setRaiseError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function respond(id: string) {
    if (!responseText.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/assurance/findings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managementResponse: responseText.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setActionError(body.message ?? "Could not submit the response.");
        return;
      }
      setRespondingTo(null);
      setResponseText("");
      router.refresh();
    } catch {
      setActionError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resolve(id: string, status: "resolved" | "qualified") {
    setActionError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/assurance/findings/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setActionError(body.message ?? "Could not update the finding.");
        return;
      }
      router.refresh();
    } catch {
      setActionError("Network error. Try again.");
    }
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          {raising ? (
            <div className="w-full space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                >
                  <option value="observation">Observation</option>
                  <option value="minor">Minor</option>
                  <option value="significant">Significant</option>
                  <option value="material_misstatement">Material misstatement</option>
                </select>
                <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="sm:col-span-2" />
              </div>
              <Textarea placeholder="What was found and its effect" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              {raiseError && <p className="text-sm text-red-600">{raiseError}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={raiseFinding} disabled={busy}>
                  {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Raise finding
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRaising(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setRaising(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Raise finding
            </Button>
          )}
        </div>
      )}

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {items.length === 0 && (
        <Card>
          <CardContent className="py-6 text-sm text-zinc-500">No findings raised yet.</CardContent>
        </Card>
      )}

      {items.map((f) => (
        <Card key={f.id} className={f.severity === "material_misstatement" ? "border-red-200" : undefined}>
          <CardContent className="space-y-2 py-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={f.severity} />
                  <span className="font-medium text-zinc-900">{f.title}</span>
                </div>
                <p className="mt-1 max-w-[60ch] text-sm text-zinc-600">{f.description}</p>
              </div>
              <Badge variant="outline" className="text-xs capitalize">
                {f.status.replace(/_/g, " ")}
              </Badge>
            </div>

            {f.managementResponse && (
              <div className="rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                <span className="font-medium">Management response: </span>
                {f.managementResponse}
              </div>
            )}

            {canRespond && (f.status === "open") && (
              <div>
                {respondingTo === f.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="What was done to correct this."
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => respond(f.id)} disabled={busy}>
                        Submit response
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRespondingTo(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setRespondingTo(f.id)}>
                    Respond
                  </Button>
                )}
              </div>
            )}

            {canManage && (f.status === "management_responded" || f.status === "open") && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => resolve(f.id, "resolved")}>
                  Mark resolved
                </Button>
                <Button size="sm" variant="outline" onClick={() => resolve(f.id, "qualified")}>
                  Qualify opinion
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    material_misstatement: "bg-red-100 text-red-900 hover:bg-red-100",
    significant: "bg-amber-100 text-amber-900 hover:bg-amber-100",
  };
  const style = styles[severity];
  if (!style) {
    return (
      <Badge variant="outline" className="text-xs capitalize">
        {severity}
      </Badge>
    );
  }
  return <Badge className={`text-xs capitalize ${style}`}>{severity.replace(/_/g, " ")}</Badge>;
}
