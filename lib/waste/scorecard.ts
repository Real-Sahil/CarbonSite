/**
 * Carrier scorecard: what each carrier's loads and transfer notes show. Facts first, then flags a person should
 * look at. No single score: a blended number would hide which fact is the problem. Pure; the loader reads the
 * organisation's own rows.
 */

export type CarrierLoad = { carrierRegistration: string | null; carrierName: string | null; weightTonnes: number };
export type CarrierNote = {
  carrierRegistration?: string | null;
  carrierName?: string | null;
  recorded: boolean;
  /** Fields the reviewer changed from the suggestion when the note was approved; null when not measured. */
  changedFields: number | null;
  registerCheck?: { status: string; company?: { status: string | null } } | null;
};
export type CarrierFlag = { level: "red" | "amber"; text: string };
export type CarrierRow = {
  key: string;
  name: string;
  registration: string | null;
  loads: number;
  totalTonnes: number;
  medianTonnes: number | null;
  heavyLoads: number;
  notesReceived: number;
  notesRecorded: number;
  measuredNotes: number;
  avgChangedFields: number | null;
  register: string | null;
  company: string | null;
  flags: CarrierFlag[];
};

const norm = (s: string | null | undefined) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export const carrierKey = (reg: string | null | undefined, name: string | null | undefined): string =>
  norm(reg) ? `reg:${norm(reg)}` : norm(name) ? `name:${norm(name)}` : "";

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Edits are only judged once a carrier has at least this many measured notes. */
export const MIN_MEASURED = 3;

export function scoreCarriers(loads: CarrierLoad[], notes: CarrierNote[]): CarrierRow[] {
  const rows = new Map<string, { name: string; registration: string | null; weights: number[]; notes: CarrierNote[] }>();
  const slot = (reg: string | null | undefined, name: string | null | undefined) => {
    const key = carrierKey(reg, name);
    if (!key) return null;
    let r = rows.get(key);
    if (!r) {
      r = { name: (name ?? reg ?? "").trim() || "Unnamed carrier", registration: reg?.trim() || null, weights: [], notes: [] };
      rows.set(key, r);
    }
    if (!r.registration && reg) r.registration = reg.trim();
    return r;
  };
  for (const l of loads) slot(l.carrierRegistration, l.carrierName)?.weights.push(l.weightTonnes);
  for (const n of notes) slot(n.carrierRegistration, n.carrierName)?.notes.push(n);

  return [...rows.entries()].map(([key, r]) => {
    const med = r.weights.length ? median(r.weights) : null;
    const heavy = med === null ? 0 : r.weights.filter((w) => w > 3 * med).length;
    const measured = r.notes.filter((n) => n.changedFields !== null);
    const avg = measured.length ? measured.reduce((a, n) => a + (n.changedFields ?? 0), 0) / measured.length : null;
    // The most recent register result for this carrier decides its status; notes are checked in list order (newest first).
    const checked = r.notes.find((n) => n.registerCheck);
    const register = checked?.registerCheck?.status ?? null;
    const company = checked?.registerCheck?.company?.status ?? null;

    const flags: CarrierFlag[] = [];
    if (r.registration && register === null) flags.push({ level: "amber", text: "Register not checked yet" });
    if (register === "not_found") flags.push({ level: "red", text: "Not on the Environment Agency register" });
    if (register === "expired") flags.push({ level: "red", text: "Registration expired" });
    if (company && company.toLowerCase() !== "active") flags.push({ level: "red", text: `Company is ${company.replace(/-/g, " ")}` });
    if (heavy > 0) flags.push({ level: "amber", text: `${heavy} ${heavy === 1 ? "load" : "loads"} far heavier than usual` });
    if (measured.length >= MIN_MEASURED && avg !== null && avg >= 1) flags.push({ level: "amber", text: "Reviewers change most notes from this carrier" });

    return {
      key,
      name: r.name,
      registration: r.registration,
      loads: r.weights.length,
      totalTonnes: Math.round(r.weights.reduce((a, b) => a + b, 0) * 1000) / 1000,
      medianTonnes: med === null ? null : Math.round(med * 1000) / 1000,
      heavyLoads: heavy,
      notesReceived: r.notes.length,
      notesRecorded: r.notes.filter((n) => n.recorded).length,
      measuredNotes: measured.length,
      avgChangedFields: avg === null ? null : Math.round(avg * 10) / 10,
      register,
      company,
      flags,
    };
  }).sort((a, b) => b.flags.length - a.flags.length || b.loads - a.loads || a.name.localeCompare(b.name));
}
