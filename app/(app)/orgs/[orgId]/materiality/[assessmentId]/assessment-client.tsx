"use client";

import { Table } from "@/components/ui/table";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IRO_LABELS, STATUS_LABELS, isMaterialByScore } from "@/lib/materiality";

const selectClass = "h-9 w-full rounded-md border border-[#E5E7EB] bg-white px-2 text-sm shadow-sm disabled:opacity-60";

type Topic = {
  id: string;
  esrsCode: string | null;
  topicName: string;
  iroType: string;
  impactScore: number | null;
  financialScore: number | null;
  isMaterial: boolean;
  rationale: string | null;
};

async function call(url: string, method: string, body?: unknown) {
  try {
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { message: "Couldn't reach the server. Check your connection and try again." } };
  }
}

export function StarterButton({ orgId, assessmentId }: { orgId: string; assessmentId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3">
      {msg && <p className="text-sm text-[#374151]">{msg}</p>}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await call(`/api/orgs/${orgId}/materiality/${assessmentId}/starter-topics`, "POST");
            setMsg(r.ok ? `Added ${r.data?.added ?? 0} topics` : r.data?.message ?? "Could not add topics.");
            router.refresh();
          })
        }
      >
        {pending ? "Adding…" : "Add the ESRS starter topics"}
      </Button>
    </div>
  );
}

export function StatusControl({ orgId, assessmentId, status, approvedAt }: { orgId: string; assessmentId: string; status: string; approvedAt: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [date, setDate] = useState(approvedAt);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const body: Record<string, unknown> = { status: value };
      if (value === "approved" || value === "published") body.approvedAt = date || new Date().toISOString().slice(0, 10);
      if (value === "published") body.publishedAt = new Date().toISOString();
      if (value === "draft" || value === "stakeholder_review") {
        body.approvedAt = null;
        body.publishedAt = null;
      }
      const r = await call(`/api/orgs/${orgId}/materiality/${assessmentId}`, "PATCH", body);
      setMsg(r.ok ? { ok: true, text: "Saved" } : { ok: false, text: r.data?.message ?? "Could not save." });
      router.refresh();
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[#374151]" htmlFor="ma-status">Status</label>
        <select id="ma-status" value={value} onChange={(e) => setValue(e.target.value)} className={selectClass}>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {(value === "approved" || value === "published") && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#374151]" htmlFor="ma-date">Date approved</label>
          <Input id="ma-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      )}
      <Button type="button" size="sm" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save status"}</Button>
      {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}

function Row({ orgId, assessmentId, topic, canEdit }: { orgId: string; assessmentId: string; topic: Topic; canEdit: boolean }) {
  const router = useRouter();
  const [t, setT] = useState(topic);
  // Until a person ticks the box, material follows the scores.
  const [override, setOverride] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const material = override ? t.isMaterial : isMaterialByScore(t);
  const score = (v: number | null) => (v == null ? "" : String(v));

  function save() {
    start(async () => {
      const r = await call(`/api/orgs/${orgId}/materiality/${assessmentId}/topics/${t.id}`, "PATCH", {
        topicName: t.topicName,
        esrsCode: t.esrsCode,
        iroType: t.iroType,
        impactScore: t.impactScore,
        financialScore: t.financialScore,
        rationale: t.rationale?.trim() ? t.rationale : null,
        ...(override ? { isMaterial: t.isMaterial } : {}),
      });
      setMsg(r.ok ? "Saved" : r.data?.message ?? "Could not save.");
      if (r.ok) router.refresh();
    });
  }

  function remove() {
    start(async () => {
      const r = await call(`/api/orgs/${orgId}/materiality/${assessmentId}/topics/${t.id}`, "DELETE");
      if (r.ok) router.refresh();
      else setMsg(r.data?.message ?? "Could not delete.");
    });
  }

  const scoreSelect = (key: "impactScore" | "financialScore", label: string) => (
    <select
      aria-label={`${label} for ${t.topicName}`}
      className={selectClass}
      disabled={!canEdit}
      value={score(t[key])}
      onChange={(e) => setT({ ...t, [key]: e.target.value === "" ? null : Number(e.target.value) })}
    >
      <option value="">–</option>
      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );

  return (
    <tr className="align-top">
      <td className="px-5 py-3">
        <p className="font-medium text-[#111827]">{t.topicName}</p>
        <p className="text-xs text-[#6B7280]">{t.esrsCode ?? "Own topic"} · {IRO_LABELS[t.iroType] ?? t.iroType}</p>
      </td>
      <td className="w-24 px-2 py-3">{scoreSelect("impactScore", "Impact score")}</td>
      <td className="w-24 px-2 py-3">{scoreSelect("financialScore", "Financial score")}</td>
      <td className="w-28 px-2 py-3">
        <label className="flex items-center gap-2 text-sm text-[#374151]">
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={material}
            onChange={(e) => { setOverride(true); setT({ ...t, isMaterial: e.target.checked }); }}
          />
          Material
        </label>
      </td>
      <td className="min-w-[220px] px-2 py-3">
        <textarea
          aria-label={`Reason for ${t.topicName}`}
          rows={2}
          maxLength={5000}
          disabled={!canEdit}
          value={t.rationale ?? ""}
          onChange={(e) => setT({ ...t, rationale: e.target.value })}
          className="w-full rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-sm shadow-sm disabled:opacity-60"
        />
      </td>
      <td className="px-3 py-3 text-right">
        {canEdit && (
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={pending} onClick={save}>Save</Button>
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={remove}>Delete</Button>
            </div>
            {msg && <p className="text-xs text-[#374151]">{msg}</p>}
          </div>
        )}
      </td>
    </tr>
  );
}

export function TopicEditor({ orgId, assessmentId, canEdit, topics }: { orgId: string; assessmentId: string; canEdit: boolean; topics: Topic[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [iro, setIro] = useState("impact");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add() {
    if (!name.trim()) return;
    start(async () => {
      const r = await call(`/api/orgs/${orgId}/materiality/${assessmentId}/topics`, "POST", {
        topics: [{ topicName: name.trim(), iroType: iro, esrsCode: null, isMaterial: false }],
      });
      if (r.ok) {
        setName("");
        setMsg(null);
        router.refresh();
      } else setMsg(r.data?.message ?? "Could not add the topic.");
    });
  }

  return (
    <div>
      {topics.length === 0 ? (
        <p className="px-5 py-6 text-sm text-[#374151]">No topics yet. Add the ESRS starter topics, or your own below.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#F3F4F6] text-left text-xs text-[#6B7280]">
                <th className="px-5 py-2 font-medium">Topic</th>
                <th className="px-2 py-2 font-medium">Impact (1 to 5)</th>
                <th className="px-2 py-2 font-medium">Financial (1 to 5)</th>
                <th className="px-2 py-2 font-medium">Outcome</th>
                <th className="px-2 py-2 font-medium">Reason</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {topics.map((t) => <Row key={t.id} orgId={orgId} assessmentId={assessmentId} topic={t} canEdit={canEdit} />)}
            </tbody>
          </Table>
        </div>
      )}
      {canEdit && (
        <div className="flex flex-wrap items-end gap-3 border-t border-[#F3F4F6] px-5 py-4">
          <div className="min-w-[260px] flex-1">
            <label className="mb-1.5 block text-xs font-medium text-[#374151]" htmlFor="mt-name">Add your own topic (for example one specific to your sector)</label>
            <Input id="mt-name" value={name} maxLength={300} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#374151]" htmlFor="mt-iro">Type</label>
            <select id="mt-iro" value={iro} onChange={(e) => setIro(e.target.value)} className={selectClass}>
              {Object.entries(IRO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <Button type="button" size="sm" disabled={pending || !name.trim()} onClick={add}>Add topic</Button>
          {msg && <p className="text-sm text-red-600">{msg}</p>}
        </div>
      )}
    </div>
  );
}
