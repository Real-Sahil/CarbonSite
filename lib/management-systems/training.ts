// The training matrix: people down the side, competence requirements across
// the top, and for each cell the latest record's state. Pure, so the page and
// the certification pack draw the same picture.

export const EXPIRING_DAYS = 60;

export type MatrixCompetence = { id: string; title: string; validityMonths: number | null };
export type MatrixRecord = { id: string; competenceId: string; personUserId: string | null; personName: string; employer: string | null; completedOn: Date | null; expiresOn: Date | null };
export type CellState = "valid" | "expiring" | "expired" | "no_expiry";
export type MatrixCell = { state: CellState; recordId: string; completedOn: string | null; expiresOn: string | null };
export type MatrixRow = { key: string; name: string; employer: string | null; cells: Record<string, MatrixCell> };

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Same person across records: the user when there is one, else the name and employer, case-insensitive. */
export function personKey(r: Pick<MatrixRecord, "personUserId" | "personName" | "employer">): string {
  return r.personUserId ? `u:${r.personUserId}` : `n:${r.personName.trim().toLowerCase()}|${(r.employer ?? "").trim().toLowerCase()}`;
}

export function cellState(expiresOn: Date | null, today: Date): CellState {
  if (!expiresOn) return "no_expiry";
  const days = (expiresOn.getTime() - today.getTime()) / 86_400_000;
  if (days < 0) return "expired";
  return days <= EXPIRING_DAYS ? "expiring" : "valid";
}

export function trainingMatrix(competences: MatrixCompetence[], records: MatrixRecord[], today: Date) {
  const known = new Set(competences.map((c) => c.id));
  const rows = new Map<string, MatrixRow>();
  const sorted = [...records].sort((a, b) => (a.completedOn?.getTime() ?? 0) - (b.completedOn?.getTime() ?? 0));
  for (const r of sorted) {
    if (!known.has(r.competenceId)) continue;
    const key = personKey(r);
    const row = rows.get(key) ?? { key, name: r.personName, employer: r.employer, cells: {} };
    // Later records replace earlier ones (a renewed card replaces the expired one).
    row.cells[r.competenceId] = { state: cellState(r.expiresOn, today), recordId: r.id, completedOn: iso(r.completedOn), expiresOn: iso(r.expiresOn) };
    rows.set(key, row);
  }
  const list = [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
  const totals = { expired: 0, expiring: 0 };
  for (const row of list) for (const c of Object.values(row.cells)) if (c.state === "expired") totals.expired++; else if (c.state === "expiring") totals.expiring++;
  return { rows: list, totals };
}
