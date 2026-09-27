import { createHash } from "crypto";
import type { Archiver } from "archiver";
import { prisma } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { csvLine, zipSafeName } from "@/lib/assurance/pack";
import { SECTIONS, getTopic } from "./topics";
import type { QuestionSet } from "./catalogue/types";

// A questionnaire's answer pack: every question reference with the
// organisation's answer and the documents attached to it, ready to copy into
// the scheme's or client's portal. Built from saved answers only; drafts are
// not included until someone saves them.

export const MAX_PQQ_EVIDENCE_BYTES = 100 * 1024 * 1024;

export async function writePqqPack(archive: Archiver, opts: { orgId: string; set: QuestionSet; generatedBy: string }) {
  const manifest: Array<{ name: string; sha256: string }> = [];
  const add = (name: string, body: string | Buffer, sha256?: string) => {
    const buf = typeof body === "string" ? Buffer.from(body, "utf8") : body;
    manifest.push({ name, sha256: sha256 ?? createHash("sha256").update(buf).digest("hex") });
    archive.append(buf, { name });
  };
  const keys = [...new Set(opts.set.questions.map((q) => q.topicKey))];
  const answers = await prisma.pqqAnswer.findMany({ where: { organizationId: opts.orgId, topicKey: { in: keys } } });
  const byKey = new Map(answers.map((a) => [a.topicKey, a]));
  const fileIds = [...new Set(answers.flatMap((a) => a.evidenceFileIds))];
  const files = fileIds.length
    ? await prisma.evidenceFile.findMany({ where: { organizationId: opts.orgId, id: { in: fileIds } }, select: { id: true, filename: true, byteSize: true, checksum: true, storageKey: true } })
    : [];
  const fileName = new Map<string, string>();
  let bytes = 0;
  for (const f of files) {
    if (bytes + f.byteSize > MAX_PQQ_EVIDENCE_BYTES || !f.storageKey || f.storageKey === "pending") continue;
    try {
      const buf = await getObject(f.storageKey);
      const name = `documents/${f.id.slice(-6)}-${zipSafeName(f.filename)}`;
      add(name, buf, f.checksum || undefined);
      fileName.set(f.id, name);
      bytes += buf.length;
    } catch {
      // Listed in answers.csv as not included.
    }
  }

  let csv = csvLine(["question", "section", "topic", "question_text", "response", "answer", "documents"]);
  let unanswered = 0;
  for (const q of opts.set.questions) {
    const topic = getTopic(q.topicKey);
    const a = byKey.get(q.topicKey);
    if (!a || (!a.answer && !a.response)) unanswered++;
    csv += csvLine([
      q.ref,
      topic ? SECTIONS[topic.section] : "",
      topic?.title ?? "Own answer",
      q.text ?? "",
      a?.response ?? "",
      a?.answer ?? "",
      (a?.evidenceFileIds ?? []).map((id) => fileName.get(id) ?? `${files.find((f) => f.id === id)?.filename ?? id} (not included)`).join("; "),
    ]);
  }
  add("answers.csv", csv);
  add(
    "README.txt",
    [
      `${opts.set.name}${opts.set.issuer ? ` (${opts.set.issuer})` : ""}${opts.set.version ? `, ${opts.set.version}` : ""}`,
      `Answer pack generated ${new Date().toISOString()} by ${opts.generatedBy} from MetricOra.`,
      ``,
      `${opts.set.questions.length} questions, ${unanswered} without a saved answer.`,
      opts.set.sourceUrl ? `Question set: ${opts.set.sourceUrl}` : ``,
      `Answers are the organisation's own. Check each against the questionnaire before you submit it.`,
      ``,
      `  answers.csv       one row per question: response, answer and documents`,
      `  documents/        the documents attached to the answers`,
      `  manifest.sha256   SHA-256 of every file`,
      ``,
    ].join("\n"),
  );
  archive.append(manifest.map((m) => `${m.sha256}  ${m.name}`).join("\n") + "\n", { name: "manifest.sha256" });
}
