// Production Approval Test runner. Pure: the caller injects `send` (create-receipt call), so nothing here fetches or
// reads env. A scenario passes only when Defra accepted the receipt (2xx); C01 and H02 pass only when refused (4xx).
// Built, not run: no route calls it.
export type PatScenario = { id: string; receipt: unknown; expectRefused?: boolean; skip?: boolean };
export type PatSend = (receipt: unknown) => Promise<{ status: number }>;
export type PatOutcome = { id: string; status: number | null; passed: boolean; skipped: boolean };

export async function runPat(scenarios: PatScenario[], send: PatSend): Promise<PatOutcome[]> {
  const outcomes: PatOutcome[] = [];
  for (const s of scenarios) {
    if (s.skip) {
      outcomes.push({ id: s.id, status: null, passed: false, skipped: true });
      continue;
    }
    let status = 0; // a thrown send is a failure, never a pass
    try {
      status = (await send(s.receipt)).status;
    } catch {
      /* status stays 0 */
    }
    const passed = s.expectRefused ? status >= 400 && status < 500 : status >= 200 && status < 300;
    outcomes.push({ id: s.id, status, passed, skipped: false });
  }
  return outcomes;
}
