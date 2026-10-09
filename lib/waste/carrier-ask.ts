/**
 * Asking a carrier for what a transfer note is missing. Pure: the fields a note needs before it can be recorded,
 * and the plain email that asks for them. A person sends it from the app; nothing is sent automatically.
 */

export const NOTE_FIELDS = [
  { key: "reference", label: "transfer note reference" },
  { key: "tonnes", label: "weight in tonnes" },
  { key: "date", label: "date of collection" },
  { key: "ewc", label: "waste code (EWC)" },
  { key: "carrierRegistration", label: "carrier registration number" },
] as const;

type Reading = { reference?: string; tonnes?: number; date?: string; ewc?: string; carrierRegistration?: string } | null | undefined;

/** The labels of what the reader did not find, in the order a carrier would look for them. */
export function missingFields(reading: Reading): string[] {
  const r = reading ?? {};
  return NOTE_FIELDS.filter((f) => r[f.key as keyof typeof r] === undefined || r[f.key as keyof typeof r] === "").map((f) => f.label);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The email a carrier receives: names the sender and the note, lists the gaps, asks for a reply to the sender. */
export function carrierAskEmail(input: { orgName: string; senderName: string; noteTitle: string; missing: string[]; note?: string | null }) {
  const list = input.missing.map((m) => `- ${m}`).join("\n");
  const extra = input.note?.trim() ? `\n\n${input.note.trim()}` : "";
  const text = `Hello,

${input.senderName} at ${input.orgName} has received your transfer note "${input.noteTitle}" but some details are missing before we can record the load.

Please reply to this email with:
${list}${extra}

Thank you.`;
  const html = `<p>Hello,</p><p>${esc(input.senderName)} at ${esc(input.orgName)} has received your transfer note &ldquo;${esc(input.noteTitle)}&rdquo; but some details are missing before we can record the load.</p><p>Please reply to this email with:</p><ul>${input.missing.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>${input.note?.trim() ? `<p>${esc(input.note.trim())}</p>` : ""}<p>Thank you.</p>`;
  return { subject: `Details needed for transfer note ${input.noteTitle}`.slice(0, 200), text, html };
}
