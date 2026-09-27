import { createHash } from "crypto";
import { TOPICS, getTopic } from "./topics";

// Mapping a client's own questionnaire onto the answer topics, so a question
// already answered for the Common Assessment Standard (or another client)
// comes up answered. Matching is by keywords and is only a suggestion: the
// person importing the questionnaire checks and changes it. A question that
// matches nothing gets its own answer, keyed by its text, which is reused
// when the same question appears again.

const STOP = new Set("a an and are as at be by can company does do for from have how in is it its of on or please provide the their this to what when which who with you your yes no details copy".split(" "));

const PHRASES: Array<[RegExp, string]> = [
  [/employer'?s'? liability/i, "financial.employers_liability"],
  [/public liability/i, "financial.public_liability"],
  [/professional indemnity/i, "financial.professional_indemnity"],
  [/product liability/i, "financial.product_liability"],
  [/(contract works|contractors'? all risks?)/i, "financial.contractors_all_risk"],
  [/(audited )?accounts|turnover|financial statements/i, "financial.accounts"],
  [/iso ?14001|environmental management system certif/i, "env.iso14001"],
  [/iso ?9001|quality management system certif/i, "quality.iso9001"],
  [/iso ?45001|ohsas ?18001/i, "hs.iso45001"],
  [/iso\/?(iec)? ?27001/i, "infosec.iso27001"],
  [/cyber essentials/i, "infosec.cyber_essentials"],
  [/iso ?19650|\bBIM\b/i, "im.iso19650"],
  [/\bssip\b|safety schemes in procurement|chas|safecontractor|constructionline/i, "hs.ssip"],
  [/modern slavery|human trafficking/i, "corporate.modern_slavery"],
  [/brib|corruption/i, "corporate.anti_bribery"],
  [/whistleblow/i, "corporate.whistleblowing"],
  [/carbon reduction plan|ppn ?0?06|net zero/i, "env.carbon_reduction_plan"],
  [/\bSECR\b|carbon (emissions )?report|greenhouse gas|scope [123]/i, "env.carbon_reporting"],
  [/waste carrier|waste broker/i, "env.waste_carrier"],
  [/environmental polic/i, "env.policy"],
  [/health (and|&) safety polic/i, "hs.policy"],
  [/quality polic/i, "quality.policy"],
  [/drug|alcohol/i, "hs.drugs_alcohol"],
  [/cscs|cpcs|npors|skills card/i, "hs.card_scheme"],
  [/riddor|accident|near miss|incident/i, "hs.accidents"],
  [/risk assessment|method statement|rams/i, "hs.risk_assessment"],
  [/\bcdm\b|principal contractor|principal designer/i, "hs.cdm_roles"],
  [/equality|diversity|inclusion|discriminat/i, "fir.policy"],
  [/data protection|gdpr|privacy notice/i, "infosec.data_protection_policy"],
  [/living wage/i, "corporate.real_living_wage"],
  [/minimum wage/i, "corporate.minimum_wage"],
  [/gender pay/i, "corporate.gender_pay_gap"],
  [/prompt payment|fair payment|payment practice/i, "corporate.payment_code"],
  [/training|competen/i, "hs.training"],
  [/subcontractor|supply chain/i, "hs.subcontractors"],
  [/company (registration|number)|companies house/i, "identity.company_number"],
  [/\bVAT\b/i, "identity.vat_number"],
  [/registered (office|address)/i, "identity.registered_office"],
];

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

/** The best answer topic for a question, or null when nothing fits well. */
export function suggestTopic(question: string): string | null {
  for (const [re, key] of PHRASES) if (re.test(question)) return key;
  const q = new Set(words(question));
  let best: { key: string; score: number } | null = null;
  for (const t of TOPICS) {
    const tw = words(t.title);
    if (!tw.length) continue;
    const hits = tw.filter((w) => q.has(w)).length;
    const score = hits / tw.length;
    if (hits >= 2 && score >= 0.5 && (!best || score > best.score)) best = { key: t.key, score };
  }
  return best?.key ?? null;
}

/** Key for a question with no matching topic: its own answer, found again by its text. */
export function customTopicKey(question: string): string {
  return `custom:${createHash("sha256").update(question.trim().toLowerCase().replace(/\s+/g, " ")).digest("hex").slice(0, 20)}`;
}

export const isAnswerKey = (key: string) => !!getTopic(key) || /^custom:[a-f0-9]{20}$/.test(key);

/** One question per non-empty line; a leading reference such as "3.1", "Q12" or "A1.2)" is kept apart. */
export function parseQuestions(text: string): Array<{ ref: string; text: string }> {
  const out: Array<{ ref: string; text: string }> = [];
  for (const line of text.split(/\r?\n/)) {
    const l = line.trim();
    if (!l) continue;
    const m = l.match(/^((?:Q|Question\s*)?[A-Z]?\d+(?:\.\d+)*[a-z]?)[.):\s-]+\s*(.+)$/i);
    out.push(m ? { ref: m[1], text: m[2].trim() } : { ref: String(out.length + 1), text: l });
  }
  return out.slice(0, 500).map((q) => ({ ref: q.ref.slice(0, 20), text: q.text.slice(0, 2000) }));
}
