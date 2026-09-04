"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Loader2, Plus } from "lucide-react";

export function CreateAssessmentForm({
  orgId,
  projects,
  sites,
}: {
  orgId: string;
  projects: Array<{ id: string; name: string }>;
  sites: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [planningAuthority, setPlanningAuthority] = useState("");
  const [planningReference, setPlanningReference] = useState("");
  const [ecologistName, setEcologistName] = useState("");
  const [ecologistOrganisation, setEcologistOrganisation] = useState("");
  const [assessmentDate, setAssessmentDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError("Give the assessment a name.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/biodiversity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ...(projectId && { projectId }),
          ...(siteId && { siteId }),
          ...(planningAuthority.trim() && { planningAuthority: planningAuthority.trim() }),
          ...(planningReference.trim() && { planningReference: planningReference.trim() }),
          ...(ecologistName.trim() && { ecologistName: ecologistName.trim() }),
          ...(ecologistOrganisation.trim() && {
            ecologistOrganisation: ecologistOrganisation.trim(),
          }),
          ...(assessmentDate && { assessmentDate }),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Could not create the assessment.");
        return;
      }
      const created = (await res.json()) as { id: string };
      router.push(`/orgs/${orgId}/biodiversity/${created.id}`);
    } catch {
      setError("Network error. Try again.");
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        New assessment
      </Button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Name" htmlFor="ba-name">
          <Input
            id="ba-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Land east of Mill Lane, BNG assessment"
          />
        </Field>

        <Field label="Project" htmlFor="ba-project">
          <select
            id="ba-project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Site" htmlFor="ba-site">
          <select
            id="ba-site"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="">None</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Planning authority" htmlFor="ba-lpa">
          <Input
            id="ba-lpa"
            value={planningAuthority}
            onChange={(e) => setPlanningAuthority(e.target.value)}
            placeholder="Cherwell District Council"
          />
        </Field>

        <Field label="Planning reference" htmlFor="ba-ref">
          <Input
            id="ba-ref"
            value={planningReference}
            onChange={(e) => setPlanningReference(e.target.value)}
            placeholder="24/00123/OUT"
          />
        </Field>

        <Field label="Survey date" htmlFor="ba-date">
          <Input
            id="ba-date"
            type="date"
            value={assessmentDate}
            onChange={(e) => setAssessmentDate(e.target.value)}
          />
        </Field>

        <Field label="Ecologist" htmlFor="ba-eco">
          <Input
            id="ba-eco"
            value={ecologistName}
            onChange={(e) => setEcologistName(e.target.value)}
            placeholder="Name of the surveying ecologist"
          />
        </Field>

        <Field label="Ecologist's practice" htmlFor="ba-ecoorg">
          <Input
            id="ba-ecoorg"
            value={ecologistOrganisation}
            onChange={(e) => setEcologistOrganisation(e.target.value)}
          />
        </Field>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? "Creating" : "Create assessment"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-700">
        {label}
      </label>
      {children}
    </div>
  );
}
