// One-off tool: pulls REAL per-org monthly emissions history — the exact
// same query lib/jobs/workers/forecasting.ts's getEmissionsHistory() runs
// in production — and writes it to scripts/real_series.json (gitignored,
// never commit real customer figures).
//
// This exists to re-validate the api/forecast.py yearly_seasonality
// length-gating fix against real data instead of the synthetic proxy used
// to develop it. The fix was backtested against 80 synthetic monthly
// series and cut median holdout MAPE from 51% to 20% — strong evidence,
// but not "our actual data". Run this once real production/staging data
// is reachable to confirm the same holds there.
//
// Usage (DATABASE_URL must point at real data — never run against a
// database you don't have authorization to pull emissions data from):
//   pnpm tsx scripts/backtest-forecast-real-data.ts
//   python3 scripts/backtest-forecast-real-data.py

import { prisma } from "../lib/db";
import { getEmissionsHistory } from "../lib/jobs/workers/forecasting";
import * as fs from "fs";
import * as path from "path";

const MIN_DATA_POINTS = 12; // matches api/forecast.py's MIN_DATA_POINTS
const LOOKBACK_MONTHS = 48; // enough history to catch orgs that DO have 24+ months

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true } });
  console.log(`Found ${orgs.length} organisation(s). Pulling emissions history (lookback ${LOOKBACK_MONTHS} months)...`);

  const results: Array<{ orgId: string; dates: string[]; values: number[] }> = [];

  for (const org of orgs) {
    const history = await getEmissionsHistory(org.id, LOOKBACK_MONTHS);
    if (history.length < MIN_DATA_POINTS) continue;
    results.push({
      orgId: org.id,
      dates: history.map((h) => h.date),
      values: history.map((h) => h.value),
    });
  }

  const outFile = path.join(__dirname, "real_series.json");
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));

  console.log(`Wrote ${results.length} org series (>= ${MIN_DATA_POINTS} months of history) to ${outFile}.`);
  console.log(`Skipped ${orgs.length - results.length} org(s) with insufficient history for a holdout backtest.`);
  if (results.length === 0) {
    console.log("No orgs had enough history to backtest — nothing to compare yet.");
  } else {
    console.log("Next: python3 scripts/backtest-forecast-real-data.py");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
