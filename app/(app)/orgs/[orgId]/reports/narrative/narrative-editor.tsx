"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@/components/ui/button";
import { bulletsToDoc, docToBullets, docToParagraphs, paragraphsToDoc } from "@/lib/reports/narrative-text";

type Saved = { executiveSummary: string; keyFindings: string[]; recommendations: string; aiDrafted: boolean } | null;

const EDITOR_CLASS = "min-h-[96px] rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] focus-within:ring-2 focus-within:ring-amber-400/50 [&_.ProseMirror]:outline-none [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_p]:my-1";

// Plain text is all a report prints, so the editors allow paragraphs (and one bullet list) only.
const textKit = StarterKit.configure({ heading: false, bulletList: false, orderedList: false, listItem: false, listKeymap: false, blockquote: false, codeBlock: false, code: false, horizontalRule: false, bold: false, italic: false, strike: false, link: false, underline: false });
const listKit = StarterKit.configure({ heading: false, orderedList: false, blockquote: false, codeBlock: false, code: false, horizontalRule: false, bold: false, italic: false, strike: false, link: false, underline: false });

function Field({ id, label, hint, editor }: { id: string; label: string; hint: string; editor: Editor | null }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-[#111827]">{label}</label>
      <p className="text-xs text-[#6B7280]">{hint}</p>
      <div className={EDITOR_CLASS}>
        <EditorContent editor={editor} id={id} aria-label={label} />
      </div>
    </div>
  );
}

/**
 * The summary page of an inventory report, in the team's own words. The text
 * saved here replaces generated wording for the period; the report says who
 * wrote it. A grounded AI draft can fill the boxes (never saves on its own).
 */
export function NarrativeEditor({
  orgId,
  periods,
  periodId,
  saved,
  aiAvailable,
  canEdit,
}: {
  orgId: string;
  periods: { id: string; label: string }[];
  periodId: string;
  saved: Saved;
  aiAvailable: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [aiDrafted, setAiDrafted] = useState(saved?.aiDrafted ?? false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const summary = useEditor({ extensions: [textKit], content: paragraphsToDoc(saved?.executiveSummary ?? ""), editable: canEdit, immediatelyRender: false });
  const findings = useEditor({ extensions: [listKit], content: bulletsToDoc(saved?.keyFindings ?? []), editable: canEdit, immediatelyRender: false });
  const recs = useEditor({ extensions: [textKit], content: paragraphsToDoc(saved?.recommendations ?? ""), editable: canEdit, immediatelyRender: false });

  // Another period's text arrives with the new page; load it into the boxes.
  useEffect(() => {
    summary?.commands.setContent(paragraphsToDoc(saved?.executiveSummary ?? ""));
    findings?.commands.setContent(bulletsToDoc(saved?.keyFindings ?? []));
    recs?.commands.setContent(paragraphsToDoc(saved?.recommendations ?? ""));
    setAiDrafted(saved?.aiDrafted ?? false);
  }, [saved, summary, findings, recs]);
  useEffect(() => setMessage(null), [periodId]);

  const api = `/api/orgs/${orgId}/report-narratives/${periodId}`;
  const fail = async (res: Response, fallback: string) => {
    const b = await res.json().catch(() => null);
    setMessage({ ok: false, text: b?.message ?? fallback });
  };

  async function save() {
    if (!summary || !findings || !recs) return;
    setBusy(true);
    const res = await fetch(api, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        executiveSummary: docToParagraphs(summary.getJSON()),
        keyFindings: docToBullets(findings.getJSON()),
        recommendations: docToParagraphs(recs.getJSON()),
        aiDrafted,
      }),
    });
    setBusy(false);
    if (!res.ok) return fail(res, "Could not save.");
    setMessage({ ok: true, text: "Saved. Reports generated from now on use this text." });
    router.refresh();
  }

  async function draft() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`${api}/draft`, { method: "POST" });
    setBusy(false);
    if (!res.ok) return fail(res, "Could not draft.");
    const { draft: d } = (await res.json()) as { draft: { executiveSummary: string; keyFindings: string[]; recommendations: string } };
    summary?.commands.setContent(paragraphsToDoc(d.executiveSummary));
    findings?.commands.setContent(bulletsToDoc(d.keyFindings));
    recs?.commands.setContent(paragraphsToDoc(d.recommendations));
    setAiDrafted(true);
    setMessage({ ok: true, text: "A first draft is in the boxes, not saved. Every figure in it was checked against your data; read it, change what you need and save." });
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(api, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return fail(res, "Could not remove.");
    setMessage({ ok: true, text: "Removed. Reports go back to generated wording, or none." });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <label htmlFor="narrative-period" className="text-sm font-medium text-[#111827]">Reporting period</label>
        <select
          id="narrative-period"
          className="h-9 w-full max-w-xs rounded-[10px] border border-[#E5E7EB] bg-white px-3 text-sm"
          value={periodId}
          onChange={(e) => router.push(`/orgs/${orgId}/reports/narrative?periodId=${encodeURIComponent(e.target.value)}`)}
        >
          {periods.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>
      <Field id="narrative-summary" label="Executive summary" hint="Two or three short paragraphs: the emissions profile and what drives it." editor={summary} />
      <Field id="narrative-findings" label="Key findings" hint="One bullet each." editor={findings} />
      <Field id="narrative-recommendations" label="Recommendations" hint="What you will do about reporting and data quality, in your own words." editor={recs} />
      {aiDrafted ? <p className="text-xs text-[#374151]">This text began as an AI-assisted draft. The report will say it was written by your team starting from one.</p> : null}
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={save} disabled={busy}>Save narrative</Button>
          {aiAvailable ? <Button type="button" variant="outline" onClick={draft} disabled={busy}>Draft with AI</Button> : null}
          {saved ? <Button type="button" variant="ghost" onClick={remove} disabled={busy}>Remove my narrative</Button> : null}
        </div>
      ) : (
        <p className="text-sm text-[#6B7280]">Only editors can change this text.</p>
      )}
      {message ? <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-[#374151]" : "text-red-700"}`}>{message.text}</p> : null}
    </div>
  );
}
