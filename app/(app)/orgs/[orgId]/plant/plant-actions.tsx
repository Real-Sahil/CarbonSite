"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const input = "h-9 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm shadow-sm disabled:opacity-60";
const labelCls = "mb-1.5 block text-xs text-[#374151]";

const COLUMNS = ["serialNumber", "periodStart", "periodEnd", "operatingHours", "idleHours", "fuelLitres", "idleFuelLitres", "name"] as const;
const TEMPLATE = `${COLUMNS.join(",")}\nCAT0320DKBZ01234,2026-05-01,2026-05-02,7.5,1.8,96.4,,CAT 320 excavator\n`;

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message ?? `Request failed (${res.status})`);
  return data;
}

/** Minimal CSV: quoted fields with doubled quotes, comma separated. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quoted) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') quoted = false;
        else cur += c;
      } else if (c === '"') quoted = true;
      else if (c === ",") { cells.push(cur); cur = ""; }
      else cur += c;
    }
    cells.push(cur);
    rows.push(cells.map((c) => c.trim()));
  }
  return rows;
}

export function AddMachineForm({ orgId, sites }: { orgId: string; sites: { id: string; name: string }[] }) {
  const router = useRouter();
  const empty = { name: "", category: "", serialNumber: "", fuelType: "diesel", ownership: "owned", siteId: "", supplierName: "" };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await send(`/api/orgs/${orgId}/plant/assets`, "POST", { ...form, siteId: form.siteId || null });
      setForm(empty);
      setMsg({ ok: true, text: "Machine added" });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Could not add the machine" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="plant-name" className={labelCls}>Name</label>
        <input id="plant-name" required maxLength={200} className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. CAT 320 excavator (EX-04)" />
      </div>
      <div>
        <label htmlFor="plant-category" className={labelCls}>Type</label>
        <input id="plant-category" maxLength={60} className={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Excavator, dumper, generator" />
      </div>
      <div>
        <label htmlFor="plant-serial" className={labelCls}>Serial number / PIN</label>
        <input id="plant-serial" maxLength={100} className={input} value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
      </div>
      <div>
        <label htmlFor="plant-fuel" className={labelCls}>Fuel</label>
        <input id="plant-fuel" list="plant-fuels" required maxLength={40} className={input} value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value })} />
        <datalist id="plant-fuels">
          <option value="diesel" />
          <option value="HVO" />
          <option value="HVO50" />
          <option value="electric" />
        </datalist>
      </div>
      <div>
        <label htmlFor="plant-ownership" className={labelCls}>Owned or hired</label>
        <select id="plant-ownership" className={input} value={form.ownership} onChange={(e) => setForm({ ...form, ownership: e.target.value })}>
          <option value="owned">Owned</option>
          <option value="hired">Hired</option>
        </select>
      </div>
      <div>
        <label htmlFor="plant-site" className={labelCls}>Site</label>
        <select id="plant-site" className={input} value={form.siteId} onChange={(e) => setForm({ ...form, siteId: e.target.value })}>
          <option value="">Unassigned</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="plant-supplier" className={labelCls}>Hire company</label>
        <input id="plant-supplier" maxLength={200} className={input} value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" size="sm" disabled={busy}>{busy ? "Adding…" : "Add machine"}</Button>
        {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
      </div>
    </form>
  );
}

export function ReadingsUpload({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const [header, ...lines] = parseCsv(await file.text());
      const idx = Object.fromEntries(COLUMNS.map((c) => [c, header?.indexOf(c) ?? -1]));
      if (idx.serialNumber < 0 || idx.periodStart < 0 || idx.periodEnd < 0) {
        throw new Error("The file needs serialNumber, periodStart and periodEnd columns. Download the template for the layout.");
      }
      const rows = lines.map((cells) =>
        Object.fromEntries(
          COLUMNS.filter((c) => idx[c] >= 0 && cells[idx[c]] !== "" && cells[idx[c]] != null).map((c) => [c, cells[idx[c]]]),
        ),
      );
      const r = await send(`/api/orgs/${orgId}/plant/readings`, "POST", { rows });
      setMsg({
        ok: true,
        text: `${r.readingsCreated} readings added${r.duplicates ? `, ${r.duplicates} already on file` : ""}${r.assetsRegistered.length ? `, ${r.assetsRegistered.length} new machines added to the register` : ""}.`,
      });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="plant-readings" className={labelCls}>Upload readings (CSV, one row per machine per period)</label>
      <input id="plant-readings" type="file" accept=".csv,text/csv" disabled={busy} onChange={upload} className="text-sm" />
      <a
        href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
        download="plant-telematics-template.csv"
        className="text-xs text-[#111827] underline underline-offset-2"
      >
        Download the template
      </a>
      {busy && <p className="text-sm text-[#374151]">Uploading…</p>}
      {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}
