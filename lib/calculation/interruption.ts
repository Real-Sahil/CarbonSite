// A calculation run whose invocation is killed mid-chunk leaves a claim that
// goes stale. Each reclaim of such a claim counts one interruption
// (CalculationRun.interruptedAttempts). Once the count reaches
// MAX_INTERRUPTED_ATTEMPTS the run fails instead of being resumed again, so a
// run that keeps killing its invocation (for example one oversized chunk)
// cannot loop forever. Kept pure so the cap is tested without a database.

export const MAX_INTERRUPTED_ATTEMPTS = 3;

/** True once a run has been interrupted as often as it may be. */
export function interruptionsExhausted(interruptedAttempts: number): boolean {
  return interruptedAttempts >= MAX_INTERRUPTED_ATTEMPTS;
}
