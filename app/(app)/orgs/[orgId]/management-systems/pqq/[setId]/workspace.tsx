"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Option = { id: string; name: string };
type Response = "yes" | "no" | "not_applicable";
export type AnswerCard = {
  key: string;
  refs: string[];
  texts: string[];
  title: string;
  section: string;
  guidance: string | null;
  yesNo: boolean;
  document: boolean;
  response: string | null;
  answer: string;
  evidenceFileIds: string[];
  updatedAt: string | null;
  draft: { response: "yes" | "no" | null; answer: string } | null;
};

const refRange = (refs: string[]) => (refs.length > 3 ? `${refs[0]} to ${refs[refs.length - 1]}` : refs.join(", "));

export function PqqWorkspace({ orgId, setId, custom, cards, files, canEdit }: { orgId: string; setId: string; custom: boolean; cards: AnswerCard[]; files: Option[]; canEdit: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "open" | "drafts">("open");
  const [fileOptions, setFileOptions] = useState(files);
  const done = cards.filter((c) => c.answer || c.response).length;
  const shown = useMemo(
    () => cards.filter((c) => filter === "all" || (filter === "open" ? !(c.answer || c.response) : !(c.answer || c.response) && c.draft)),
    [cards, filter],
  );
  const sections = [...new Set(shown.map((c) => c.section))];

  function removeSet() {
    if (!window.confirm("Delete this questionnaire? Your answers stay and are reused by other questionnaires.")) return;
    void fetch(`/api/orgs/${orgId}/pqq/sets/${setId}`, { method: "DELETE" }).then(() => router.push(`/orgs/${orgId}/management-systems/pqq`));
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          <p className="text-sm tabular-nums text-[#374151]">{done} of {cards.length} answered</p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#F3F4F6]" aria-hidden="true">
            <div className="h-full rounded-full bg-[#c2410c]" style={{ width: `${cards.length ? Math.round((done / cards.length) * 100) : 0}%` }} />
          </div>
        </div>
        {canEdit && <a href={`/api/orgs/${orgId}/pqq/export?set=${encodeURIComponent(setId)}`} className="rounded-lg bg-[#111827] px-3 py-1.5 text-sm text-white hover:bg-black">Download answer pack</a>}
        {canEdit && custom && <Button size="sm" variant="outline" onClick={removeSet} className="text-red-600">Delete questionnaire</Button>}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
        {([["open", "Not answered"], ["drafts", "Can be drafted from records"], ["all", "All"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} className={`rounded-full px-3 py-1 text-xs ${filter === k ? "bg-[#111827] text-white" : "border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]"}`}>
            {l}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="text-sm text-[#6B7280]">Nothing to show here.</p>}
      {sections.map((s) => (
        <section key={s} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-[#111827]">{s}</h2>
          {shown.filter((c) => c.section === s).map((c) => (
            <Card key={c.key} orgId={orgId} card={c} canEdit={canEdit} files={fileOptions} addFile={(o) => setFileOptions((f) => [o, ...f])} />
          ))}
        </section>
      ))}
    </div>
  );
}

function Card({ orgId, card, canEdit, files, addFile }: { orgId: string; card: AnswerCard; canEdit: boolean; files: Option[]; addFile: (o: Option) => void }) {
  const router = useRouter();
  const [response, setResponse] = useState<string | null>(card.response);
  const [answer, setAnswer] = useState(card.answer);
  const [evidence, setEvidence] = useState<string[]>(card.evidenceFileIds);
  const [pick, setPick] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const id = `pqq-${card.key.replace(/[^a-z0-9]+/gi, "-")}`;

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/pqq/answers/${encodeURIComponent(card.key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: (response as Response | null) ?? null, answer: answer.trim() || null, evidenceFileIds: evidence }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) return setMsg(json?.message ?? "Could not save.");
      setMsg("Saved");
      router.refresh();
    });
  }

  async function upload(file: File) {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/orgs/${orgId}/management-systems/files`, { method: "POST", body });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setMsg(json?.message ?? "Could not upload the file.");
    addFile({ id: json.evidenceId, name: json.filename });
    setEvidence((e) => [...new Set([...e, json.evidenceId])]);
  }

  return (
    <div className="flex flex-col gap-3 rounded-[12px] border border-[#E5E7EB] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[#111827]">{card.title}</p>
          <p className="text-xs text-[#6B7280]">Question {refRange(card.refs)}{card.updatedAt ? ` · saved ${card.updatedAt.slice(0, 10)}` : ""}</p>
        </div>
        {(card.answer || card.response) && <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-800">Answered</span>}
      </div>
      {card.texts.length > 0 && <ul className="list-disc pl-5 text-sm text-[#374151]">{card.texts.map((t, i) => <li key={i}>{t}</li>)}</ul>}
      {card.guidance && <p className="text-xs text-[#6B7280]">{card.guidance}</p>}
      {card.draft && canEdit && !answer && (
        <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-sm text-[#374151]">
          <p className="text-xs font-medium uppercase tracking-wide text-sky-800">Drafted from your records</p>
          <p className="mt-1 whitespace-pre-wrap">{card.draft.answer}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => { setAnswer(card.draft!.answer); if (card.draft!.response) setResponse(card.draft!.response); }}>Use this draft</Button>
        </div>
      )}
      {card.yesNo && (
        <div className="flex gap-4 text-sm" role="radiogroup" aria-label="Response">
          {([["yes", "Yes"], ["no", "No"], ["not_applicable", "Not applicable"]] as const).map(([v, l]) => (
            <label key={v} className="flex items-center gap-1.5">
              <input type="radio" name={`${id}-response`} checked={response === v} onChange={() => setResponse(v)} disabled={!canEdit} />
              {l}
            </label>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-answer`} className="text-xs">Answer</Label>
        <Textarea id={`${id}-answer`} value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} readOnly={!canEdit} />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-[#374151]">Documents{card.document ? " (usually asked for)" : ""}</p>
        {evidence.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {evidence.map((fid) => (
              <li key={fid} className="flex items-center gap-2">
                <a href={`/api/orgs/${orgId}/evidence/${fid}/download`} target="_blank" rel="noreferrer" className="underline underline-offset-2">{files.find((f) => f.id === fid)?.name ?? "File"}</a>
                {canEdit && <button type="button" onClick={() => setEvidence(evidence.filter((x) => x !== fid))} className="text-xs text-[#6B7280] hover:text-red-600">Remove</button>}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Attach an existing file" value={pick} onChange={(e) => setPick(e.target.value)} className="h-9 max-w-[280px] rounded-md border border-[#E5E7EB] bg-white px-2 text-sm">
              <option value="">Attach an existing file…</option>
              {files.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <Button type="button" size="sm" variant="outline" disabled={!pick} onClick={() => { setEvidence([...new Set([...evidence, pick])]); setPick(""); }}>Attach</Button>
            <label className="cursor-pointer rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm text-[#374151] hover:bg-[#F9FAFB]">
              Upload
              <input type="file" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          </div>
        )}
      </div>
      {canEdit && (
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={save} disabled={isPending}>{isPending ? "Saving…" : "Save answer"}</Button>
          {msg && <span role="status" className={`text-xs ${msg === "Saved" ? "text-emerald-700" : "text-red-600"}`}>{msg}</span>}
        </div>
      )}
    </div>
  );
}
