"use client";

import { Table } from "@/components/ui/table";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { REGISTERS, type Field, type RegisterKey } from "@/lib/management-systems/registers/config";
import { FormActions, FormError, FormField, FormSection, fieldClass } from "@/components/forms/form-kit";

type Option = { id: string; name: string };
type ChecklistResult = { item: string; result: "pass" | "fail" | "na"; note?: string };
export type Acks = Record<string, { version: number; count: number; mine: boolean; names: string[] }>;
type Row = Record<string, unknown> & { id: string };
type Values = Record<string, unknown>;

const RATING_TONE = (n: number) => (n >= 15 ? "bg-red-50 text-red-700" : n >= 8 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800");

export function RegisterWorkspace({
  orgId,
  registerKey,
  rows,
  canEdit,
  members,
  people,
  refs,
  files,
  checklists,
  frameworks,
  acks,
  webMemberCount,
}: {
  orgId: string;
  registerKey: RegisterKey;
  rows: Row[];
  canEdit: boolean;
  members: Option[];
  people: Option[];
  refs: Partial<Record<RegisterKey, Option[]>>;
  files: Option[];
  checklists: Record<string, string[]>;
  frameworks: Option[];
  acks: Acks;
  webMemberCount: number;
}) {
  const config = REGISTERS[registerKey];
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [fileOptions, setFileOptions] = useState(files);
  const lookups: Lookups = { members, people, refs, files: fileOptions, addFile: (o) => setFileOptions((f) => [o, ...f]), checklists, frameworks, orgId, acks, webMemberCount };

  useEffect(() => {
    const id = window.location.hash.replace(/^#row-/, "");
    if (id && rows.some((r) => r.id === id)) setOpen(id);
  }, [rows]);

  const fieldBy = new Map(config.fields.map((f) => [f.name, f]));
  const columnLabel = (c: string) => (c === "rating" ? "Rating" : c === "residualRating" ? "Residual" : fieldBy.get(c)?.label ?? c);

  return (
    <div className="flex flex-col gap-4">
      {canEdit && !adding && (
        <Button size="sm" onClick={() => setAdding(true)} className="self-start bg-[#c2410c] text-white hover:bg-[#9a3412]">Add {config.singular}</Button>
      )}
      {adding && (
        <section className="rounded-[14px] border border-[#E5E7EB] bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-[#111827]">New {config.singular}</h2>
          <RowForm orgId={orgId} registerKey={registerKey} initial={{}} lookups={lookups} onDone={() => setAdding(false)} />
        </section>
      )}

      {rows.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-[#E5E7EB] p-6 text-sm text-[#6B7280]">No {config.label.toLowerCase()} recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-[#E5E7EB] bg-white">
          <Table className="w-full text-left text-sm">
            <thead className="border-b border-[#E5E7EB] text-xs text-[#6B7280]">
              <tr>
                <th className="px-4 py-2.5 font-medium">{fieldBy.get(config.titleField)?.label}</th>
                {config.columns.map((c) => <th key={c} className="whitespace-nowrap px-4 py-2.5 font-medium">{columnLabel(c)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {rows.map((row) => (
                <RowView key={row.id} orgId={orgId} registerKey={registerKey} row={row} open={open === row.id} onToggle={() => setOpen(open === row.id ? null : row.id)} canEdit={canEdit} lookups={lookups} />
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}

type Lookups = {
  members: Option[];
  people: Option[];
  refs: Partial<Record<RegisterKey, Option[]>>;
  files: Option[];
  addFile: (o: Option) => void;
  checklists: Record<string, string[]>;
  frameworks: Option[];
  orgId: string;
  acks: Acks;
  webMemberCount: number;
};

function display(f: Field | undefined, v: unknown, lookups: Lookups): string {
  if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return "-";
  if (!f) return String(v);
  if (f.type === "select") return f.options?.find(([k]) => k === v)?.[1] ?? String(v);
  if (f.type === "member") return lookups.members.find((m) => m.id === v)?.name ?? "Former member";
  if (f.type === "person") return lookups.people.find((m) => m.id === v)?.name ?? "Former member";
  if (f.type === "row") return lookups.refs[f.ref!]?.find((m) => m.id === v)?.name ?? "-";
  if (f.type === "file") return lookups.files.find((m) => m.id === v)?.name ?? "File";
  if (f.type === "frameworks") return (v as string[]).map((s) => lookups.frameworks.find((x) => x.id === s)?.name ?? s).join(", ");
  if (f.type === "boolean") return v ? "Yes" : "No";
  if (f.type === "checklist") {
    const r = v as ChecklistResult[];
    const fails = r.filter((x) => x.result === "fail").length;
    return `${r.filter((x) => x.result === "pass").length} passed, ${fails} failed${fails ? `: ${r.filter((x) => x.result === "fail").map((x) => x.item).join("; ")}` : ""}`;
  }
  return String(v);
}

function isOverdue(v: unknown) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && v < new Date().toISOString().slice(0, 10);
}

function RowView({ orgId, registerKey, row, open, onToggle, canEdit, lookups }: { orgId: string; registerKey: RegisterKey; row: Row; open: boolean; onToggle: () => void; canEdit: boolean; lookups: Lookups }) {
  const config = REGISTERS[registerKey];
  const fieldBy = new Map(config.fields.map((f) => [f.name, f]));
  const rating = (l: unknown, i: unknown) => (typeof l === "number" && typeof i === "number" ? l * i : null);
  const cell = (c: string) => {
    if (c === "rating" || c === "residualRating") {
      const n = c === "rating" ? rating(row.likelihood, row.impact) : rating(row.residualLikelihood, row.residualImpact);
      return n == null ? "-" : <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${RATING_TONE(n)}`}>{n}</span>;
    }
    const f = fieldBy.get(c);
    const text = display(f, row[c], lookups);
    const closed = ["closed", "retired", "withdrawn", "completed", "achieved", "implemented", "held"].includes(String(row.status ?? ""));
    if (f?.type === "date" && !closed && isOverdue(row[c]) && config.reminders?.some((r) => r.field === c)) {
      return <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">{text} overdue</span>;
    }
    return text;
  };
  const title = String(row[config.titleField] ?? "");

  return (
    <>
      <tr id={`row-${row.id}`} className="cursor-pointer hover:bg-[#F9FAFB]" onClick={onToggle} aria-expanded={open}>
        <td className="max-w-[360px] px-4 py-3 font-medium text-[#111827]">
          <span className="line-clamp-2">{title}</span>
          {registerKey === "policies" && <span className="text-xs font-normal text-[#6B7280]">Version {String(row.version)}</span>}
          {config.acknowledgeable && lookups.acks[row.id] && (
            <span className="block text-xs font-normal text-[#6B7280]">
              Read by {lookups.acks[row.id].count} of {lookups.webMemberCount}
            </span>
          )}
        </td>
        {config.columns.map((c) => <td key={c} className="whitespace-nowrap px-4 py-3 text-[#374151]">{cell(c)}</td>)}
      </tr>
      {open && (
        <tr>
          <td colSpan={config.columns.length + 1} className="bg-[#F9FAFB] px-4 py-4">
            {config.acknowledgeable && row.status === "approved" && <Acknowledge orgId={orgId} registerKey={registerKey} row={row} ack={lookups.acks[row.id]} webMemberCount={lookups.webMemberCount} />}
            {canEdit ? (
              <RowForm orgId={orgId} registerKey={registerKey} initial={row} lookups={lookups} onDone={onToggle} />
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                {config.fields.map((f) => (
                  <div key={f.name}>
                    <dt className="text-xs text-[#6B7280]">{f.label}</dt>
                    <dd className="whitespace-pre-wrap text-sm text-[#111827]">{display(f, row[f.name], lookups)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function RowForm({ orgId, registerKey, initial, lookups, onDone }: { orgId: string; registerKey: RegisterKey; initial: Values; lookups: Lookups; onDone: () => void }) {
  const router = useRouter();
  const config = REGISTERS[registerKey];
  const isNew = !initial.id;
  const empty = (f: Field) => (f.type === "frameworks" || f.type === "checklist" ? [] : f.type === "boolean" ? false : "");
  const [values, setValues] = useState<Values>(() => Object.fromEntries(config.fields.map((f) => [f.name, initial[f.name] ?? empty(f)])));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const base = `/api/orgs/${orgId}/management-systems/registers/${registerKey}`;
  const set = (name: string, v: unknown) => setValues((s) => ({ ...s, [name]: v }));

  function payload() {
    const out: Values = {};
    for (const f of config.fields) {
      const v = values[f.name];
      const before = initial[f.name] ?? empty(f);
      if (!isNew && JSON.stringify(v) === JSON.stringify(before)) continue;
      if (f.type === "score" || f.type === "number") out[f.name] = v === "" || v == null ? (isNew ? undefined : null) : Number(v);
      else if (f.type === "frameworks" || f.type === "boolean" || f.type === "checklist") out[f.name] = v;
      else out[f.name] = typeof v === "string" && v.trim() === "" ? (isNew ? undefined : null) : v;
    }
    return out;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const body = payload();
    if (!isNew && Object.keys(body).length === 0) return onDone();
    startTransition(async () => {
      const res = await fetch(isNew ? base : `${base}/${initial.id}`, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (!res.ok) return setError(json?.message ?? "Could not save.");
      onDone();
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm(`Delete this ${config.singular}? Evidence links to it are removed too.`)) return;
    startTransition(async () => {
      const res = await fetch(`${base}/${initial.id}`, { method: "DELETE" });
      if (!res.ok) return setError("Could not delete.");
      onDone();
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5" onClick={(e) => e.stopPropagation()}>
      <FormSection cols={2}>
      {config.fields.map((f) => {
        const id = `${registerKey}-${String(initial.id ?? "new")}-${f.name}`;
        const wide = f.type === "textarea" || f.type === "frameworks" || f.type === "checklist";
        return (
          <FormField key={f.name} label={f.label} htmlFor={id} span={wide ? 4 : 1} optional={!f.required} hint={f.help}>
            {f.type === "textarea" ? (
              <Textarea id={id} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} rows={f.name === "body" ? 10 : 3} />
            ) : f.type === "select" || f.type === "member" || f.type === "person" || f.type === "row" || f.type === "score" ? (
              <select id={id} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} className={fieldClass}>
                <option value="">{f.type === "member" || f.type === "person" ? "Nobody" : "Choose…"}</option>
                {(f.type === "select"
                  ? f.options!.map(([v, l]) => ({ id: v, name: l }))
                  : f.type === "member"
                    ? lookups.members
                    : f.type === "person"
                      ? lookups.people
                      : f.type === "row"
                        ? (lookups.refs[f.ref!] ?? [])
                        : [1, 2, 3, 4, 5].map((n) => ({ id: String(n), name: String(n) }))
                ).map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            ) : f.type === "file" ? (
              <FileField id={id} value={String(values[f.name] ?? "")} onChange={(v) => set(f.name, v)} lookups={lookups} />
            ) : f.type === "checklist" ? (
              <ChecklistField id={id} items={lookups.checklists[String(values.templateId ?? "")] ?? []} value={(values[f.name] as ChecklistResult[]) ?? []} onChange={(v) => set(f.name, v)} />
            ) : f.type === "boolean" ? (
              <input id={id} type="checkbox" checked={Boolean(values[f.name])} onChange={(e) => set(f.name, e.target.checked)} className="h-4 w-4" />
            ) : f.type === "frameworks" ? (
              <div id={id} className="flex flex-wrap gap-x-4 gap-y-2">
                {lookups.frameworks.map((fw) => {
                  const list = (values[f.name] as string[]) ?? [];
                  return (
                    <label key={fw.id} className="flex items-center gap-1.5 text-sm text-[#374151]">
                      <input type="checkbox" checked={list.includes(fw.id)} onChange={() => set(f.name, list.includes(fw.id) ? list.filter((x) => x !== fw.id) : [...list, fw.id])} className="h-4 w-4" />
                      {fw.name}
                    </label>
                  );
                })}
              </div>
            ) : (
              <Input id={id} type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"} step={f.type === "number" ? "any" : undefined} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} />
            )}
          </FormField>
        );
      })}
      </FormSection>
      <FormError>{error}</FormError>
      <FormActions
        start={!isNew && <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={isPending} className="text-red-700 hover:text-red-800">Delete</Button>}
      >
        <Button type="button" size="sm" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving…" : isNew ? "Add" : "Save"}</Button>
      </FormActions>
    </form>
  );
}

function FileField({ id, value, onChange, lookups }: { id: string; value: string; onChange: (v: string) => void; lookups: Lookups }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/orgs/${lookups.orgId}/management-systems/files`, { method: "POST", body });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setError(json?.message ?? "Could not upload the file.");
    lookups.addFile({ id: json.evidenceId, name: json.filename });
    onChange(json.evidenceId);
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 max-w-[320px] rounded-md border border-[#E5E7EB] bg-white px-2 text-sm">
          <option value="">No file</option>
          {lookups.files.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <label className="cursor-pointer rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm text-[#374151] hover:bg-[#F9FAFB]">
          {busy ? "Uploading…" : "Upload"}
          <input type="file" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {value && (
          <a href={`/api/orgs/${lookups.orgId}/evidence/${value}/download`} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-2">Open</a>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ChecklistField({ id, items, value, onChange }: { id: string; items: string[]; value: ChecklistResult[]; onChange: (v: ChecklistResult[]) => void }) {
  if (!items.length && !value.length) return <p id={id} className="text-sm text-[#6B7280]">Choose a checklist first.</p>;
  const list = items.length ? items : value.map((v) => v.item);
  const byItem = new Map(value.map((v) => [v.item, v]));
  // Only answered items are stored: an unanswered item never counts as a pass.
  const update = (item: string, patch: Partial<ChecklistResult>) => {
    const changed: ChecklistResult = { ...(byItem.get(item) ?? { item, result: "na" }), ...patch };
    const next = new Map(byItem).set(item, changed);
    onChange(list.flatMap((i) => (next.has(i) ? [next.get(i)!] : [])));
  };
  return (
    <ol id={id} className="flex flex-col divide-y divide-[#F3F4F6] rounded-md border border-[#E5E7EB] bg-white">
      {list.map((item, i) => {
        const r = byItem.get(item);
        return (
          <li key={item} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
            <span className="flex-1 text-sm text-[#111827]">{i + 1}. {item}</span>
            <span className="flex gap-3 text-sm">
              {(["pass", "fail", "na"] as const).map((res) => (
                <label key={res} className="flex items-center gap-1">
                  <input type="radio" name={`${id}-${i}`} checked={r?.result === res} onChange={() => update(item, { result: res })} />
                  {res === "pass" ? "Pass" : res === "fail" ? "Fail" : "N/A"}
                </label>
              ))}
            </span>
            {r?.result === "fail" && (
              <Input aria-label={`Note for ${item}`} value={r.note ?? ""} onChange={(e) => update(item, { note: e.target.value })} placeholder="What was wrong" className="h-8 bg-white sm:w-64" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Acknowledge({ orgId, registerKey, row, ack, webMemberCount }: { orgId: string; registerKey: RegisterKey; row: Row; ack?: Acks[string]; webMemberCount: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const confirm = () =>
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/management-systems/registers/${registerKey}/${row.id}/acknowledge`, { method: "POST" });
      if (!res.ok) return setError((await res.json().catch(() => null))?.message ?? "Could not record that.");
      router.refresh();
    });
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm" onClick={(e) => e.stopPropagation()}>
      <p className="text-[#374151]">
        Version {String(row.version)}: read by {ack?.count ?? 0} of {webMemberCount} web users
        {ack?.names.length ? ` (${ack.names.slice(0, 12).join(", ")}${ack.names.length > 12 ? ", ..." : ""})` : ""}.
      </p>
      {ack?.mine ? (
        <p className="text-emerald-700">You confirmed you have read this version.</p>
      ) : (
        <Button size="sm" variant="outline" onClick={confirm} disabled={isPending} className="self-start">
          {isPending ? "Saving…" : "I have read this version"}
        </Button>
      )}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
