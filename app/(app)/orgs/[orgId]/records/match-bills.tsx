"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileStack, Loader2, Mail } from "lucide-react";

type Match = {
  recordId: string;
  score: number;
  reasons: string[];
  record: {
    id: string;
    amount: number;
    unit: string;
    date: string | null;
    supplierName: string | null;
    description: string | null;
    category: string;
    facility: string | null;
    hasEvidence: boolean;
  };
};

type Row = {
  key: string;
  /** Set for bills that arrived through the bill inbox. */
  inboxItemId?: string;
  from?: string;
  filename: string;
  state: "queued" | "reading" | "matched" | "none" | "error" | "attached" | "dismissed";
  message?: string;
  evidenceId?: string;
  read?: string;
  matches: Match[];
  choice?: string;
};

/** Mirrors CONFIDENT_MATCH in lib/evidence/match.ts. */
const CONFIDENT = 80;
const MAX_FILES = 20;

/**
 * Attach bills to records that already exist (imported or typed in): each
 * file is read, matched to records by quantity, supplier, dates and category,
 * and attached only when the person confirms. Moves records from Partially
 * verified to Verified once they are approved.
 */
export function MatchBills({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const [inbox, setInbox] = useState<{ configured: boolean; address: string | null } | null>(null);

  /** Reads one bill (upload or inbox) and looks up the records it could evidence. */
  async function process(key: string, read: () => Promise<Response>) {
    update(key, { state: "reading" });
    try {
      const res = await read();
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        update(key, { state: "error", message: d.message ?? "Couldn't read this file." });
        return;
      }
      const summary = d.amount && d.unit ? `${Number(d.amount.value).toLocaleString("en-GB")} ${d.unit}${d.supplier ? `, ${d.supplier.value}` : ""}${d.periodEnd ? `, to ${d.periodEnd.value}` : ""}` : "No quantity found";
      const m = await fetch(`/api/orgs/${orgId}/evidence/${d.evidenceId}/matches`);
      const md = await m.json().catch(() => ({}));
      const matches: Match[] = m.ok ? (md.matches ?? []) : [];
      update(key, {
        evidenceId: d.evidenceId,
        read: summary,
        matches,
        state: matches.length ? "matched" : "none",
        choice: matches[0]?.score >= CONFIDENT ? matches[0].recordId : undefined,
        message: m.ok ? undefined : (md.message ?? "Couldn't look for matching records."),
      });
    } catch {
      update(key, { state: "error", message: "Couldn't reach the server. Check your connection and try again." });
    }
  }

  async function readAll(files: File[]) {
    const picked = files.slice(0, MAX_FILES);
    const start: Row[] = picked.map((f, i) => ({ key: `${Date.now()}-${i}`, filename: f.name, state: "queued", matches: [] }));
    setRows((rs) => [...start, ...rs.filter((r) => r.inboxItemId)]);
    setBusy(true);
    // One at a time: reading a photo runs OCR and the bill route is rate limited.
    for (const [i, file] of picked.entries()) {
      const body = new FormData();
      body.append("file", file);
      await process(start[i].key, () => fetch(`/api/orgs/${orgId}/evidence/bill`, { method: "POST", body }));
    }
    setBusy(false);
  }

  // Bills emailed to the inbox: list them, then read and match each in turn.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/orgs/${orgId}/bill-inbox`).catch(() => null);
      if (!res?.ok || cancelled) return;
      const d = await res.json();
      setInbox({ configured: d.configured, address: d.address });
      const items = (d.items ?? []) as { id: string; filename: string; from: string }[];
      if (!items.length) return;
      const inboxRows: Row[] = items.map((it) => ({ key: `inbox-${it.id}`, inboxItemId: it.id, from: it.from, filename: it.filename, state: "queued", matches: [] }));
      setRows((rs) => [...rs, ...inboxRows]);
      setBusy(true);
      for (const r of inboxRows) {
        if (cancelled) break;
        await process(r.key, () => fetch(`/api/orgs/${orgId}/bill-inbox/${r.inboxItemId}`, { method: "POST" }));
      }
      if (!cancelled) setBusy(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function turnOnInbox(rotate = false) {
    const res = await fetch(`/api/orgs/${orgId}/bill-inbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rotate }),
    }).catch(() => null);
    if (res?.ok) setInbox(await res.json());
  }

  async function dismiss(row: Row) {
    if (!row.inboxItemId) return;
    const res = await fetch(`/api/orgs/${orgId}/bill-inbox/${row.inboxItemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
    }).catch(() => null);
    if (res?.ok) update(row.key, { state: "dismissed", message: undefined });
  }

  async function attach(row: Row): Promise<boolean> {
    if (!row.evidenceId || !row.choice) return false;
    const res = await fetch(`/api/orgs/${orgId}/records/${row.choice}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evidenceId: row.evidenceId }),
    }).catch(() => null);
    if (res?.ok) {
      if (row.inboxItemId) {
        await fetch(`/api/orgs/${orgId}/bill-inbox/${row.inboxItemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "attached" }),
        }).catch(() => null);
      }
      update(row.key, { state: "attached", message: undefined });
      return true;
    }
    const d = res ? await res.json().catch(() => ({})) : {};
    update(row.key, { message: d.message ?? "Couldn't attach. Try again." });
    return false;
  }

  async function attachAllChosen() {
    setBusy(true);
    let any = false;
    for (const row of rows) {
      if (row.state === "matched" && row.choice) any = (await attach(row)) || any;
    }
    setBusy(false);
    if (any) router.refresh();
  }

  const ready = rows.filter((r) => r.state === "matched" && r.choice).length;

  return (
    <div className="flex flex-col gap-4">
      {inbox?.configured && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-[#F9FAFB] px-4 py-3 text-sm text-[#374151]">
          <Mail className="h-4 w-4 text-[#6B7280]" aria-hidden />
          {inbox.address ? (
            <>
              <span>
                Or forward bills to <span className="font-medium text-[#111827] select-all">{inbox.address}</span>. They appear below to match.
              </span>
              <button type="button" onClick={() => void turnOnInbox(true)} className="text-xs text-[#6B7280] underline underline-offset-2">
                New address
              </button>
            </>
          ) : (
            <>
              <span>Get an address your team can forward bills to.</span>
              <button type="button" onClick={() => void turnOnInbox()} className="text-xs font-medium underline underline-offset-2">
                Turn on bill inbox
              </button>
            </>
          )}
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[#D1D5DB] px-4 py-4 hover:bg-[#F9FAFB]">
        {busy ? <Loader2 className="h-5 w-5 animate-spin text-[#6B7280]" /> : <FileStack className="h-5 w-5 text-[#6B7280]" />}
        <span className="text-sm text-[#374151]">
          {busy ? "Reading and matching. Photos can take up to a minute each." : `Choose up to ${MAX_FILES} bills or receipts (PDF or photo)`}
        </span>
        <input
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) void readAll(files);
          }}
        />
      </label>

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-xs text-[#6B7280]">
                <th className="py-2 pr-3 font-medium">File</th>
                <th className="py-2 pr-3 font-medium">Read</th>
                <th className="py-2 pr-3 font-medium">Matching record</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-[#F3F4F6] align-top">
                  <td className="py-2.5 pr-3 max-w-[180px]">
                    <span className="block truncate" title={row.filename}>{row.filename}</span>
                    {row.from && <span className="block truncate text-xs text-[#6B7280]" title={row.from}>Emailed by {row.from}</span>}
                  </td>
                  <td className="py-2.5 pr-3 text-[#374151] tabular-nums">
                    {row.state === "reading" ? <span className="text-[#6B7280]">Reading...</span> : row.state === "queued" ? <span className="text-[#6B7280]">Waiting</span> : (row.read ?? "-")}
                  </td>
                  <td className="py-2.5 pr-3">
                    {row.state === "matched" && (
                      <div className="flex flex-col gap-1.5">
                        {row.matches.map((m) => (
                          <label key={m.recordId} className="flex items-start gap-2 text-xs">
                            <input
                              type="radio"
                              name={`match-${row.key}`}
                              className="mt-0.5"
                              checked={row.choice === m.recordId}
                              onChange={() => update(row.key, { choice: m.recordId })}
                            />
                            <span>
                              <span className="font-medium text-[#111827]">
                                {m.record.amount.toLocaleString("en-GB")} {m.record.unit}
                                {m.record.date ? `, ${m.record.date}` : ""}
                              </span>{" "}
                              <span className="text-[#374151]">
                                {m.record.category}
                                {m.record.facility ? `, ${m.record.facility}` : ""}
                                {m.record.supplierName ? `, ${m.record.supplierName}` : ""}
                              </span>
                              <span className="block text-[#6B7280]">
                                {m.score >= CONFIDENT ? "Strong match: " : "Possible match: "}
                                {m.reasons.join(", ")}
                              </span>
                            </span>
                          </label>
                        ))}
                        <label className="flex items-center gap-2 text-xs text-[#6B7280]">
                          <input type="radio" name={`match-${row.key}`} checked={!row.choice} onChange={() => update(row.key, { choice: undefined })} />
                          None of these
                        </label>
                      </div>
                    )}
                    {row.state === "none" && (
                      <span className="text-xs text-[#6B7280]">
                        {row.message ?? "No record with this quantity. Use Add from a bill to create one."}
                      </span>
                    )}
                    {row.state === "error" && <span role="alert" className="text-xs text-red-600">{row.message}</span>}
                    {row.state === "attached" && <span className="text-xs text-emerald-700">Attached</span>}
                    {row.state === "dismissed" && <span className="text-xs text-[#6B7280]">Dismissed</span>}
                    {row.state === "matched" && row.message && <span role="alert" className="block text-xs text-red-600">{row.message}</span>}
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    {row.state === "matched" && row.choice && (
                      <button type="button" disabled={busy} onClick={async () => { if (await attach(row)) router.refresh(); }} className="text-xs font-medium underline underline-offset-2 disabled:opacity-50">
                        Attach
                      </button>
                    )}
                    {row.inboxItemId && (row.state === "matched" || row.state === "none" || row.state === "error") && (
                      <button type="button" onClick={() => void dismiss(row)} className="ml-3 text-xs text-[#6B7280] underline underline-offset-2">
                        Dismiss
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ready > 1 && (
        <div>
          <button type="button" disabled={busy} onClick={attachAllChosen} className="inline-flex items-center gap-1.5 rounded-md bg-[#111827] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            Attach {ready} selected
          </button>
        </div>
      )}
    </div>
  );
}
