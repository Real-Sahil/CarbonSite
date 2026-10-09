// Times the stages of a page load and logs one line when the whole load is slow. Nothing about the organisation's
// data goes in the line, only its id and how long each stage took, so the slowest stage can be found from the logs
// of a real deployment before anyone splits a page by guesswork.

import { createLogger } from "@/lib/logger";

const log = createLogger("page-timing");

export function stageTimer(page: string, slowAfterMs = 1500) {
  const start = performance.now();
  let last = start;
  const stages: Record<string, number> = {};
  return {
    /** Records how long the work since the previous mark took. */
    mark(stage: string) {
      const now = performance.now();
      stages[stage] = Math.round(now - last);
      last = now;
    },
    /** Logs the stages when the load took at least `slowAfterMs`, and returns the total. */
    done(context: { orgId: string }): number {
      const total = Math.round(performance.now() - start);
      if (total >= slowAfterMs) log.warn(`${page} was slow`, { ...context, totalMs: total, stages });
      return total;
    },
  };
}
