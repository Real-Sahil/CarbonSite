"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type SiteRow = {
  id: string;
  name: string;
  project: string;
  postcode: string | null;
  survey: { token: string; isOpen: boolean; responses: number } | null;
  split: { source: string; parts: { label: string; share: number }[] };
};

export type ImportRow = {
  id: string;
  site: string;
  month: string;
  records: number;
  approved: number;
  ownDays: number;
  ownKm: number;
  lodgingDays: number;
  averagedDays: number;
  subcontractorDays: number;
  subcontractorKm: number;
};

type Preview = {
  employers: { employer: string; days: number }[];
  months: { month: string; days: number }[];
  columns: { date: string; worker: string | null; employer: string | null; postcode: string | null };
  warnings: string[];
};

const monthName = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const fmt = (n: number) => n.toLocaleString("en-GB");

export function CommutingWorkspace({
  orgId, orgName, canEdit, sites, imports,
}: { orgId: string; orgName: string; canEdit: boolean; sites: SiteRow[]; imports: ImportRow[] }) {
  if (sites.length === 0) {
    return (
      <p className="rounded-lg border border-[#E5E7EB] bg-white p-6 text-sm text-[#374151]">
        No sites yet. Add a site to a project (with its postcode) to import attendance for it.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {canEdit && <AttendanceImport orgId={orgId} orgName={orgName} sites={sites} />}
      <SiteSurveys orgId={orgId} canEdit={canEdit} sites={sites} />
      <ImportsTable orgId={orgId} canEdit={canEdit} imports={imports} />
    </div>
  );
}

function AttendanceImport({ orgId, orgName, sites }: { orgId: string; orgName: string; sites: SiteRow[] }) {
  const router = useRouter();
  const [siteId, setSiteId] = useState(sites[0].id);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [own, setOwn] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const site = sites.find((s) => s.id === siteId)!;

  async function send(confirm: boolean) {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    const form = new FormData();
    form.set("file", file);
    form.set("siteId", siteId);
    form.set("ownEmployers", JSON.stringify([...own]));
    form.set("confirm", String(confirm));
    const res = await fetch(`/api/orgs/${orgId}/commuting/attendance`, { method: "POST", body: form });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setMessage({ tone: "error", text: body?.message ?? "The file could not be imported." });
      return;
    }
    if (!confirm) {
      const p = body as Preview;
      setPreview(p);
      // Preselect employers whose name matches the organisation's.
      const orgKey = orgName.toLowerCase().replace(/\b(ltd|limited|plc|llp)\b|[^a-z0-9]/g, "");
      setOwn(new Set(p.employers.map((e) => e.employer).filter((e) => orgKey && e.toLowerCase().replace(/\b(ltd|limited|plc|llp)\b|[^a-z0-9]/g, "") === orgKey)));
      return;
    }
    const made = (body.imports as { month: string; records: number }[]).map((i) => `${monthName(i.month)}: ${i.records} records`).join("; ");
    setMessage({ tone: "ok", text: `Imported. ${made}. They are in Records, waiting for review.` });
    setPreview(null);
    setFile(null);
    router.refresh();
  }

  return (
    <Card className="border-[#E5E7EB] shadow-none">
      <CardHeader className="border-b border-[#E5E7EB] px-6 py-4">
        <CardTitle className="text-sm font-semibold text-[#111827]">Import site attendance</CardTitle>
        <CardDescription className="mt-0.5 text-xs text-[#6B7280]">
          A CSV or Excel export from MSite, Biosite, Sitemetric or a spreadsheet, one row per sign-in, with the date,
          the person (id or name), their employer and home postcode. The file is read and discarded: only days per
          postcode district are kept.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-6 py-5">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-[#374151]" htmlFor="commute-site">
            Site
            <select
              id="commute-site"
              value={siteId}
              onChange={(e) => { setSiteId(e.target.value); setPreview(null); }}
              className="h-9 min-w-[220px] rounded-md border border-[#E5E7EB] bg-white px-2 text-sm"
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.project})</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-[#374151]" htmlFor="commute-file">
            Attendance file
            <input
              id="commute-file"
              type="file"
              accept=".csv,.xlsx,.xls,text/csv"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setMessage(null); }}
              className="text-sm"
            />
          </label>
          <Button size="sm" variant="outline" disabled={!file || busy || !site.postcode} onClick={() => send(false)}>
            {busy && !preview ? "Reading" : "Read file"}
          </Button>
        </div>
        {!site.postcode && <p className="text-xs text-amber-700">{site.name} has no postcode. Add it on the project page first.</p>}

        {preview && (
          <div className="flex flex-col gap-4 rounded-md border border-[#E5E7EB] bg-[#F9FAFB] p-4">
            <p className="text-xs text-[#374151]">
              Read {preview.months.map((m) => `${monthName(m.month)} (${fmt(m.days)} days)`).join(", ")}. Columns used: date
              &ldquo;{preview.columns.date}&rdquo;, person {preview.columns.worker ? `“${preview.columns.worker}”` : "none"}, employer{" "}
              {preview.columns.employer ? `“${preview.columns.employer}”` : "none"}, postcode {preview.columns.postcode ? `“${preview.columns.postcode}”` : "none"}.
            </p>
            {preview.warnings.length > 0 && (
              <ul className="list-disc pl-5 text-xs text-amber-800">
                {preview.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            )}
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-xs font-semibold text-[#111827]">Which employers are your own staff? Only they count in the inventory.</legend>
              {preview.employers.map((e) => (
                <label key={e.employer} className="flex items-center gap-2 text-sm text-[#374151]">
                  <input
                    type="checkbox"
                    id={`own-${e.employer}`}
                    checked={own.has(e.employer)}
                    onChange={(ev) => {
                      const next = new Set(own);
                      if (ev.target.checked) next.add(e.employer);
                      else next.delete(e.employer);
                      setOwn(next);
                    }}
                  />
                  {e.employer || "(no employer given)"}
                  <span className="text-xs text-[#6B7280]">{fmt(e.days)} days</span>
                </label>
              ))}
            </fieldset>
            <p className="text-xs text-[#6B7280]">Mode split for {site.name}: {site.split.source}.</p>
            <div>
              <Button size="sm" disabled={busy || own.size === 0} onClick={() => send(true)}>
                {busy ? "Importing" : "Create commuting records"}
              </Button>
              {own.size === 0 && <span className="ml-3 text-xs text-[#6B7280]">Tick at least one employer.</span>}
            </div>
          </div>
        )}
        {message && <p className={`text-sm ${message.tone === "error" ? "text-red-700" : "text-[#111827]"}`}>{message.text}</p>}
      </CardContent>
    </Card>
  );
}

function SiteSurveys({ orgId, canEdit, sites }: { orgId: string; canEdit: boolean; sites: SiteRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);

  async function setSurvey(siteId: string, open: boolean) {
    setBusy(siteId);
    await fetch(`/api/orgs/${orgId}/commuting/surveys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, open }),
    });
    setBusy(null);
    router.refresh();
  }

  return (
    <Card className="border-[#E5E7EB] shadow-none">
      <CardHeader className="border-b border-[#E5E7EB] px-6 py-4">
        <CardTitle className="text-sm font-semibold text-[#111827]">How people travel to each site</CardTitle>
        <CardDescription className="mt-0.5 text-xs text-[#6B7280]">
          Share a site&apos;s survey link (site board, toolbox talk or text). Three questions, no names. With 5 or more
          answers the site&apos;s own split replaces the default, which assumes everyone drives alone.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-left text-xs text-[#6B7280]">
                <th className="px-6 py-2 font-medium">Site</th>
                <th className="px-3 py-2 font-medium">Answers</th>
                <th className="px-3 py-2 font-medium">Split used</th>
                <th className="px-6 py-2 font-medium">Survey</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => {
                const link = s.survey && origin ? `${origin}/commute/${s.survey.token}` : null;
                return (
                  <tr key={s.id} className="border-b border-[#F3F4F6] align-top last:border-0">
                    <td className="px-6 py-3">
                      <div className="font-medium text-[#111827]">{s.name}</div>
                      <div className="text-xs text-[#6B7280]">{s.project}{s.postcode ? `, ${s.postcode}` : ", no postcode"}</div>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{s.survey?.responses ?? 0}</td>
                    <td className="px-3 py-3 text-xs text-[#374151]">
                      {s.split.parts.length === 0
                        ? "Default: everyone drives alone"
                        : s.split.parts.map((p) => `${p.label} ${Math.round(p.share * 100)}%`).join(", ")}
                      {s.split.parts.length > 0 && <div className="text-[#6B7280]">Share of people. Shared vehicles count once.</div>}
                    </td>
                    <td className="px-6 py-3">
                      {s.survey ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-xs ${s.survey.isOpen ? "text-[#111827]" : "text-[#6B7280]"}`}>{s.survey.isOpen ? "Open" : "Closed"}</span>
                          {s.survey.isOpen && link && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { navigator.clipboard.writeText(link); setCopied(s.id); }}
                            >
                              {copied === s.id ? "Link copied" : "Copy link"}
                            </Button>
                          )}
                          {canEdit && (
                            <Button size="sm" variant="ghost" disabled={busy === s.id} onClick={() => setSurvey(s.id, !s.survey!.isOpen)}>
                              {s.survey.isOpen ? "Close" : "Reopen"}
                            </Button>
                          )}
                        </div>
                      ) : canEdit ? (
                        <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => setSurvey(s.id, true)}>
                          Start survey
                        </Button>
                      ) : (
                        <span className="text-xs text-[#6B7280]">None</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ImportsTable({ orgId, canEdit, imports }: { orgId: string; canEdit: boolean; imports: ImportRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    if (!confirm("Delete this month's commuting records? They can be imported again.")) return;
    setError(null);
    const res = await fetch(`/api/orgs/${orgId}/commuting/imports/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.message ?? "Could not delete.");
      return;
    }
    router.refresh();
  }

  return (
    <Card className="border-[#E5E7EB] shadow-none">
      <CardHeader className="border-b border-[#E5E7EB] px-6 py-4">
        <CardTitle className="text-sm font-semibold text-[#111827]">Imported months</CardTitle>
        <CardDescription className="mt-0.5 text-xs text-[#6B7280]">
          Own staff kilometres go into the inventory once approved. Subcontractor kilometres are their employer&apos;s
          emissions (your Category 1) and are shown for project reporting only.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {error && <p className="px-6 pt-3 text-sm text-red-700">{error}</p>}
        {imports.length === 0 ? (
          <p className="px-6 py-5 text-sm text-[#6B7280]">Nothing imported yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-left text-xs text-[#6B7280]">
                  <th className="px-6 py-2 font-medium">Month</th>
                  <th className="px-3 py-2 font-medium">Site</th>
                  <th className="px-3 py-2 text-right font-medium">Own staff days</th>
                  <th className="px-3 py-2 text-right font-medium">Own staff km</th>
                  <th className="px-3 py-2 text-right font-medium">Subcontractor km</th>
                  <th className="px-3 py-2 font-medium">Records</th>
                  <th className="px-6 py-2" />
                </tr>
              </thead>
              <tbody>
                {imports.map((i) => (
                  <tr key={i.id} className="border-b border-[#F3F4F6] last:border-0">
                    <td className="px-6 py-3 text-[#111827]">{monthName(i.month)}</td>
                    <td className="px-3 py-3 text-[#374151]">{i.site}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {fmt(i.ownDays)}
                      {(i.lodgingDays > 0 || i.averagedDays > 0) && (
                        <div className="text-xs text-[#6B7280]">
                          {[i.lodgingDays > 0 && `${fmt(i.lodgingDays)} lodging`, i.averagedDays > 0 && `${fmt(i.averagedDays)} averaged`].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmt(i.ownKm)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-[#6B7280]">{fmt(i.subcontractorKm)}</td>
                    <td className="px-3 py-3 text-xs text-[#374151]">{i.records === 0 ? "None (no own staff)" : `${i.approved} of ${i.records} approved`}</td>
                    <td className="px-6 py-3 text-right">
                      {canEdit && i.approved === 0 && (
                        <Button size="sm" variant="ghost" onClick={() => remove(i.id)}>Delete</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
