import { describe, expect, it } from "vitest";
import { suggestLedgerLine, LOW_CONFIDENCE, type LedgerBucket } from "../suggest";

// Lines written the way accounting exports really read: supplier abbreviations, trade names,
// invoice references in the description, mixed case, doubled spaces. Expected values are what a
// careful bookkeeper would file. A wrong guess matters more than a "review": the line may be
// left for a person, but it must never land in the wrong bucket with high confidence.
type Row = [supplier: string, description: string, bucket: LedgerBucket, category?: string];

const ROWS: Row[] = [
  ["CERTAS ENERGY UK LTD", "INV 88213 Gas oil 5000L del 12/03", "needs_quantity", "s1-mobile"],
  ["Allstar Business Solutions", "Fuel card statement Feb", "needs_quantity", "s1-mobile"],
  ["Shell UK Oil Products", "Fuelcard transactions week 9", "needs_quantity", "s1-mobile"],
  ["Pump & Go Ltd", "Red diesel bowser 1000 litres", "needs_quantity", "s1-mobile"],
  ["Octopus Energy for Business", "Electricity Jan-Mar", "needs_quantity", "s2-electricity-lb"],
  ["E.ON Next Energy", "Half-hourly supply charges", "needs_quantity", "s2-electricity-lb"],
  ["British Gas Business", "Mains gas Q1", "needs_quantity", "s1-stationary"],
  ["Calor Gas Ltd", "LPG propane cylinders cabin heater", "needs_quantity", "s1-stationary"],
  ["Biffa Waste Services", "Skip hire 8yd x4 collections", "needs_quantity", "s3-waste"],
  ["Veolia ES (UK)", "Hazardous waste collection ref HW2231", "needs_quantity", "s3-waste"],
  ["Grundon Waste Mgt", "Landfill gate fee inert", "needs_quantity", "s3-waste"],
  ["Cool-Tech Refrigeration", "Air conditioning service and R410A top up", "needs_quantity", "s1-fugitive"],
  ["Tarmac Trading Ltd", "Ready mix concrete C32/40 order 4471", "spend", "s3-purchased-goods"],
  ["CEMEX UK Operations", "Concrete pump hire and ready-mix", "spend", "s3-purchased-goods"],
  ["Celsa Steel UK", "B500B Reinforcement bar delivered", "spend", "s3-purchased-goods"],
  ["Tata Steel UK Ltd", "Structural steel sections", "spend", "s3-purchased-goods"],
  ["Hanson Aggregates", "MOT Type 1 sub-base 120t", "spend", "s3-purchased-goods"],
  ["Jewson Ltd", "Timber C24 and plywood sheets", "spend", "s3-purchased-goods"],
  ["Ibstock Brick", "Facing brick pallets x12", "spend", "s3-purchased-goods"],
  ["Sunbelt Rentals", "Plant hire telehandler 3 weeks", "spend", "s3-purchased-goods"],
  ["Speedy Hire", "Equipment hire - breaker and compactor", "spend", "s3-purchased-goods"],
  ["Smith Haulage Ltd", "Haulage - muck away 6 loads", "spend", "s3-upstream-transport"],
  ["DPD UK", "Courier delivery charge", "spend", "s3-upstream-transport"],
  ["Trainline", "Rail tickets London - Leeds", "spend", "s3-business-travel"],
  ["Premier Inn Hotels", "Accommodation 3 nights", "spend", "s3-business-travel"],
  ["Enterprise Rent-A-Car", "Car hire 4 days", "spend", "s3-business-travel"],
  ["HMRC", "VAT quarter ended 31/03", "not_emissions"],
  ["HMRC PAYE", "PAYE and NI March", "not_emissions"],
  ["Barclays Bank", "Bank charges and interest", "not_emissions"],
  ["Nest Pensions", "Pension contributions", "not_emissions"],
  ["Payroll", "Wages w/e 14/03", "not_emissions"],
  ["Zurich Insurance", "Contract works insurance premium", "spend", "s3-purchased-goods"],
  ["Sage UK", "Software subscription annual", "spend", "s3-purchased-goods"],
  // Traps: a keyword in the wrong sense. Expected is review or the real category, never the keyword's.
  ["Network Rail Infrastructure", "Track ballast supply", "spend", "s3-purchased-goods"],
  ["Hilton Plant Services", "Pipe laying subcontract", "spend", "s3-purchased-goods"],
  ["Gas Safe Heating Ltd", "Boiler repair callout", "review"],
  ["Fuelling Solutions Construction", "Canopy construction works", "review"],
  ["Stonehouse Catering", "Site canteen supplies", "review"],
  ["Uber Eats Business", "Team lunch", "review"],
  ["Training Academy", "Training course CSCS", "spend", "s3-purchased-goods"],
  ["EV Charging Installations", "Electric vehicle charger install", "review"],
  ["Electrical Contractors Ltd", "First fix electrical contractor", "spend", "s3-purchased-goods"],
  ["Smith & Sons Electricity Services", "Rewire cabin", "review"],
  // Awkward ones: the honest answer is "review" (or a low-confidence guess), never a confident wrong one.
  ["A & B Contractors", "Invoice 1042", "review"],
  ["Mr J Smith", "Services rendered", "review"],
  ["ACME", "Misc", "review"],
];

describe("ledger suggestions on messy lines", () => {
  it("files most lines as a bookkeeper would, and never confidently wrong", () => {
    const misses: string[] = [];
    let right = 0;
    let confidentlyWrong = 0;
    for (const [supplier, description, bucket, category] of ROWS) {
      const s = suggestLedgerLine({ supplier, description });
      const ok = s.bucket === bucket && (category === undefined || s.categoryCode === category);
      if (ok) right++;
      else {
        const wrongButSure = s.bucket !== "review" && s.confidence >= LOW_CONFIDENCE;
        if (wrongButSure) confidentlyWrong++;
        misses.push(`${supplier} | ${description} -> ${s.bucket}/${s.categoryCode} (${s.confidence}) wanted ${bucket}/${category ?? "-"}`);
      }
    }
    if (misses.length) console.log(misses.join("\n"));
    expect(confidentlyWrong).toBe(0);
    expect(right / ROWS.length).toBeGreaterThanOrEqual(0.9);
  });
});
