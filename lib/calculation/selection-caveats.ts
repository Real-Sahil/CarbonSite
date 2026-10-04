// Plain-language cautions about a factor choice that is valid but easy to
// misread. They are added to the calculation's warnings, never change a figure.

type Picked = { externalId?: string | null; usageNotes?: string | null; activityType?: string | null };

const ELECTRIC = /\b(bev|ev|electric|electricity)\b/i;

export function selectionCaveats(input: {
  categoryCode: string;
  matchHint: string;
  refrigerantType?: string | null;
  factor: Picked;
}): string[] {
  const out: string[] = [];
  const { categoryCode, matchHint, factor } = input;
  const text = `${factor.externalId ?? ""} ${factor.activityType ?? ""} ${factor.usageNotes ?? ""}`;

  // A battery-electric commute priced with a petrol or diesel average car.
  if (categoryCode === "s3-commuting" && ELECTRIC.test(matchHint) && !ELECTRIC.test(text)) {
    out.push(
      "The record names an electric vehicle, but this library has no battery-electric commuting factor, so an average car (petrol and diesel) was used and will overstate the emissions. Add an organisation factor for it.",
    );
  }

  // Fugitive emissions priced without knowing which gas leaked.
  if (categoryCode === "s1-fugitive" && !(input.refrigerantType ?? "").trim()) {
    out.push(
      `No refrigerant is named on the record, so the factor for ${factor.externalId ?? "an arbitrary gas"} was used. Refrigerant gases differ by orders of magnitude (R-134a 1,300, R-32 677, R-404A 3,943 kg CO2e per kg): name the gas on the record.`,
    );
  }
  return out;
}
