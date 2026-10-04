"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SECTIONS, type SectionKey } from "@/lib/pqq/topics";
import { FormField, FormSection } from "@/components/forms/form-kit";

type Topic = { key: string; title: string; section: SectionKey };
type Q = { ref: string; text: string; topicKey: string; suggested?: boolean; own?: string };

export function ImportQuestionnaire({ orgId, topics }: { orgId: string; topics: Topic[] }) {
  const router = useRouter();
  const [meta, setMeta] = useState({ name: "", issuer: "", dueOn: "" });
  const [text, setText] = useState("");
  const [questions, setQuestions] = useState<Q[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sections = Object.entries(SECTIONS) as Array<[SectionKey, string]>;

  function preview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/pqq/sets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preview: true, text }) });
      const json = await res.json().catch(() => null);
      if (!res.ok) return setError(json?.message ?? "Could not read the questions.");
      setQuestions(json.questions.map((q: Q) => ({ ...q, own: q.suggested ? undefined : q.topicKey })));
    });
  }

  function save() {
    if (!questions) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/pqq/sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: meta.name.trim(), issuer: meta.issuer.trim() || undefined, dueOn: meta.dueOn || null, questions: questions.map(({ ref, text, topicKey }) => ({ ref, text, topicKey })) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) return setError(json?.message ?? "Could not save the questionnaire.");
      router.push(`/orgs/${orgId}/management-systems/pqq/${json.id}`);
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-[14px] border border-[#E5E7EB] bg-white p-5">
      <h2 className="text-sm font-semibold text-[#111827]">Add a client&apos;s questionnaire</h2>
      <p className="max-w-[75ch] text-sm text-[#6B7280]">
        Paste the questions, one per line, with their numbers if they have them. Each is matched to an answer topic so anything you have answered before comes up
        answered; check the matches before saving. A question that matches nothing gets its own answer.
      </p>
      <form onSubmit={preview} className="grid gap-4 sm:grid-cols-3">
        <FormSection title="Paste a client questionnaire" cols={3}>
          <FormField label="Name" htmlFor="pq-name">
            <Input id="pq-name" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} placeholder="e.g. Framework PQQ 2026" className="h-9" />
          </FormField>
          <FormField label="Client or scheme" htmlFor="pq-issuer">
            <Input id="pq-issuer" value={meta.issuer} onChange={(e) => setMeta({ ...meta, issuer: e.target.value })} className="h-9" />
          </FormField>
          <FormField label="Due" htmlFor="pq-due">
            <Input id="pq-due" type="date" value={meta.dueOn} onChange={(e) => setMeta({ ...meta, dueOn: e.target.value })} className="h-9" />
          </FormField>
          <FormField label="Questions" span={4} htmlFor="pq-text">
            <Textarea id="pq-text" value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder={"1.1 Do you hold ISO 14001?\n1.2 Provide your employer's liability insurance certificate"} />
          </FormField>
        </FormSection>
        <Button type="submit" size="sm" disabled={isPending || !text.trim()} className="self-start">{isPending && !questions ? "Reading…" : "Match questions"}</Button>
      </form>
      {questions && (
        <div className="flex flex-col gap-3">
          <ol className="flex flex-col divide-y divide-[#F3F4F6] rounded-md border border-[#E5E7EB]">
            {questions.map((q, i) => (
              <li key={`${q.ref}-${i}`} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <span className="w-14 shrink-0 font-mono text-xs text-[#6B7280]">{q.ref}</span>
                <span className="flex-1 text-sm text-[#111827]">{q.text}</span>
                <select
                  aria-label={`Answer topic for question ${q.ref}`}
                  value={q.topicKey}
                  onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, topicKey: e.target.value } : x)))}
                  className="h-9 max-w-[320px] rounded-md border border-[#E5E7EB] bg-white px-2 text-sm"
                >
                  {q.own && <option value={q.own}>Its own answer</option>}
                  {sections.map(([s, label]) => (
                    <optgroup key={s} label={label}>
                      {topics.filter((t) => t.section === s).map((t) => <option key={t.key} value={t.key}>{t.title}</option>)}
                    </optgroup>
                  ))}
                </select>
              </li>
            ))}
          </ol>
          <Button size="sm" onClick={save} disabled={isPending || !meta.name.trim()} className="self-start bg-[#c2410c] text-white hover:bg-[#9a3412]">
            {isPending ? "Saving…" : `Save ${questions.length} questions`}
          </Button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
