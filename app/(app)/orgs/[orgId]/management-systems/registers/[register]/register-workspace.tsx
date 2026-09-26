"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { REGISTERS, type Field, type RegisterKey } from "@/lib/management-systems/registers/config";

type Option = { id: string; name: string };
type Row = Record<string, unknown> & { id: string };
type Values = Record<string, unknown>;

const RATING_TONE = (n: number) => (n >= 15 ? "bg-red-50 text-red-700" : n >= 8 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800");

export function RegisterWorkspace({
  orgId,
  registerKey,
  rows,
  canEdit,
  members,
  audits,
  frameworks,
}: {
  orgId: string;
  registerKey: RegisterKey;
  rows: Row[];
  canEdit: boolean;
  members: Option[];
  audits: Option[];
  frameworks: Option[];
}) {
  const config = REGISTERS[registerKey];
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const lookups = { members, audits, frameworks };

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
          <table className="w-full text-left text-sm">
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
          </table>
        </div>
      )}
    </div>
  );
}

type Lookups = { members: Option[]; audits: Option[]; frameworks: Option[] };

function display(f: Field | undefined, v: unknown, lookups: Lookups): string {
  if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return "-";
  if (!f) return String(v);
  if (f.type === "select") return f.options?.find(([k]) => k === v)?.[1] ?? String(v);
  if (f.type === "member") return lookups.members.find((m) => m.id === v)?.name ?? "Former member";
  if (f.type === "audit") return lookups.audits.find((m) => m.id === v)?.name ?? "-";
  if (f.type === "frameworks") return (v as string[]).map((s) => lookups.frameworks.find((x) => x.id === s)?.name ?? s).join(", ");
  if (f.type === "boolean") return v ? "Yes" : "No";
  return String(v);
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
    return display(fieldBy.get(c), row[c], lookups);
  };
  const title = String(row[config.titleField] ?? "");

  return (
    <>
      <tr id={`row-${row.id}`} className="cursor-pointer hover:bg-[#F9FAFB]" onClick={onToggle} aria-expanded={open}>
        <td className="max-w-[360px] px-4 py-3 font-medium text-[#111827]">
          <span className="line-clamp-2">{title}</span>
          {registerKey === "policies" && <span className="text-xs font-normal text-[#6B7280]">Version {String(row.version)}</span>}
        </td>
        {config.columns.map((c) => <td key={c} className="whitespace-nowrap px-4 py-3 text-[#374151]">{cell(c)}</td>)}
      </tr>
      {open && (
        <tr>
          <td colSpan={config.columns.length + 1} className="bg-[#F9FAFB] px-4 py-4">
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
  const [values, setValues] = useState<Values>(() => Object.fromEntries(config.fields.map((f) => [f.name, initial[f.name] ?? (f.type === "frameworks" ? [] : f.type === "boolean" ? false : "")])));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const base = `/api/orgs/${orgId}/management-systems/registers/${registerKey}`;
  const set = (name: string, v: unknown) => setValues((s) => ({ ...s, [name]: v }));

  function payload() {
    const out: Values = {};
    for (const f of config.fields) {
      const v = values[f.name];
      const before = initial[f.name] ?? (f.type === "frameworks" ? [] : f.type === "boolean" ? false : "");
      if (!isNew && JSON.stringify(v) === JSON.stringify(before)) continue;
      if (f.type === "score") out[f.name] = v === "" || v == null ? null : Number(v);
      else if (f.type === "frameworks" || f.type === "boolean") out[f.name] = v;
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
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" onClick={(e) => e.stopPropagation()}>
      {config.fields.map((f) => {
        const id = `${registerKey}-${String(initial.id ?? "new")}-${f.name}`;
        const wide = f.type === "textarea" || f.type === "frameworks";
        return (
          <div key={f.name} className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
            <Label htmlFor={id}>{f.label}{f.required ? " (required)" : ""}</Label>
            {f.type === "textarea" ? (
              <Textarea id={id} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} rows={f.name === "body" ? 10 : 3} className="bg-white" />
            ) : f.type === "select" || f.type === "member" || f.type === "audit" || f.type === "score" ? (
              <select id={id} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} className="h-9 rounded-md border border-[#E5E7EB] bg-white px-2 text-sm">
                <option value="">{f.type === "member" ? "Nobody" : "Choose…"}</option>
                {(f.type === "select" ? f.options!.map(([v, l]) => ({ id: v, name: l })) : f.type === "member" ? lookups.members : f.type === "audit" ? lookups.audits : [1, 2, 3, 4, 5].map((n) => ({ id: String(n), name: String(n) }))).map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
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
              <Input id={id} type={f.type === "date" ? "date" : "text"} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} className="h-9 bg-white" />
            )}
            {f.help && <p className="text-xs text-[#6B7280]">{f.help}</p>}
          </div>
        );
      })}
      {error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving…" : isNew ? "Add" : "Save"}</Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>Cancel</Button>
        {!isNew && <Button type="button" size="sm" variant="outline" onClick={remove} disabled={isPending} className="ml-auto text-red-600">Delete</Button>}
      </div>
    </form>
  );
}
