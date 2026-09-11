/**
 * UK List of Wastes (EWC / European Waste Catalogue) reference data.
 *
 * Source: Environment Agency / UK Government
 * Regulation: Waste (England and Wales) Regulations 2011 (as amended post-Brexit)
 * Licence: Open Government Licence v3.0
 *
 * Codes with a trailing asterisk (*) in the name string are HAZARDOUS.
 * The six-digit code format is "XX XX XX" (chapter / group / entry).
 *
 * Usage:
 *   import { lookupEwcCode, isHazardousEwc, validateEwcCode } from "@/lib/data-sources/ewc-reference";
 *
 * This is a static embed of the most common codes used in UK construction,
 * manufacturing, and facilities management — not the full 800-entry list.
 * Full reference: https://www.gov.uk/how-to-classify-different-types-of-waste/use-the-waste-classification-guidance
 */

export interface EwcEntry {
  code: string;       // "XX XX XX" or "XX XX" or "XX" for chapters/groups
  description: string;
  hazardous: boolean;
  chapter: string;    // 2-digit chapter code
  group: string;      // 4-digit group code (or "" for chapter-level entries)
}

/** Sparse lookup: most common EWC codes seen in UK facilities/construction contexts. */
const EWC_CODES: Record<string, EwcEntry> = {
  // Chapter 01 — Mining / quarrying
  "01 01 01": { code: "01 01 01", description: "Wastes from metalliferous mineral excavation", hazardous: false, chapter: "01", group: "01 01" },
  "01 01 02": { code: "01 01 02", description: "Wastes from non-metalliferous mineral excavation", hazardous: false, chapter: "01", group: "01 01" },
  "01 04 09": { code: "01 04 09", description: "Waste sand and clays", hazardous: false, chapter: "01", group: "01 04" },

  // Chapter 02 — Agriculture / food / wood
  "02 01 01": { code: "02 01 01", description: "Sludges from washing and cleaning", hazardous: false, chapter: "02", group: "02 01" },
  "02 01 03": { code: "02 01 03", description: "Plant-tissue waste", hazardous: false, chapter: "02", group: "02 01" },
  "02 01 04": { code: "02 01 04", description: "Waste plastics (excluding packaging)", hazardous: false, chapter: "02", group: "02 01" },
  "02 01 07": { code: "02 01 07", description: "Wastes from forestry", hazardous: false, chapter: "02", group: "02 01" },
  "02 03 04": { code: "02 03 04", description: "Materials unsuitable for consumption or processing (food)", hazardous: false, chapter: "02", group: "02 03" },

  // Chapter 03 — Wood processing / paper
  "03 01 01": { code: "03 01 01", description: "Waste bark and cork", hazardous: false, chapter: "03", group: "03 01" },
  "03 01 05": { code: "03 01 05", description: "Sawdust, shavings, cuttings, wood, particle board and veneer", hazardous: false, chapter: "03", group: "03 01" },
  "03 03 01": { code: "03 03 01", description: "Waste bark and wood", hazardous: false, chapter: "03", group: "03 03" },
  "03 03 09": { code: "03 03 09", description: "Lime mud waste", hazardous: false, chapter: "03", group: "03 03" },

  // Chapter 06 — Chemical processes
  "06 01 01*": { code: "06 01 01*", description: "Sulphuric acid and sulphurous acid", hazardous: true, chapter: "06", group: "06 01" },
  "06 01 06*": { code: "06 01 06*", description: "Other acids", hazardous: true, chapter: "06", group: "06 01" },
  "06 07 03*": { code: "06 07 03*", description: "Barium sulphate sludge containing mercury", hazardous: true, chapter: "06", group: "06 07" },

  // Chapter 07 — Organic chemical processes
  "07 01 01*": { code: "07 01 01*", description: "Aqueous washing liquids and mother liquors (organic chemicals)", hazardous: true, chapter: "07", group: "07 01" },
  "07 06 01*": { code: "07 06 01*", description: "Aqueous washing liquids and mother liquors (fats/oils)", hazardous: true, chapter: "07", group: "07 06" },

  // Chapter 08 — Paints / varnishes / adhesives
  "08 01 11*": { code: "08 01 11*", description: "Waste paint and varnish containing organic solvents or other dangerous substances", hazardous: true, chapter: "08", group: "08 01" },
  "08 01 12": { code: "08 01 12", description: "Waste paint and varnish other than 08 01 11", hazardous: false, chapter: "08", group: "08 01" },
  "08 02 01": { code: "08 02 01", description: "Waste coating powders", hazardous: false, chapter: "08", group: "08 02" },
  "08 04 09*": { code: "08 04 09*", description: "Waste adhesives and sealants containing organic solvents or other dangerous substances", hazardous: true, chapter: "08", group: "08 04" },
  "08 04 10": { code: "08 04 10", description: "Waste adhesives and sealants other than 08 04 09", hazardous: false, chapter: "08", group: "08 04" },

  // Chapter 09 — Photographic industry
  "09 01 01*": { code: "09 01 01*", description: "Water-based developer and activator solutions", hazardous: true, chapter: "09", group: "09 01" },

  // Chapter 10 — Thermal processes
  "10 01 01": { code: "10 01 01", description: "Bottom ash, slag and boiler dust (excluding boiler dust mentioned in 10 01 04)", hazardous: false, chapter: "10", group: "10 01" },
  "10 01 02": { code: "10 01 02", description: "Coal fly ash", hazardous: false, chapter: "10", group: "10 01" },
  "10 02 01": { code: "10 02 01", description: "Wastes from the processing of slag", hazardous: false, chapter: "10", group: "10 02" },

  // Chapter 12 — Metal shaping
  "12 01 01": { code: "12 01 01", description: "Ferrous metal filings and turnings", hazardous: false, chapter: "12", group: "12 01" },
  "12 01 02": { code: "12 01 02", description: "Ferrous metal dust and particles", hazardous: false, chapter: "12", group: "12 01" },
  "12 01 03": { code: "12 01 03", description: "Non-ferrous metal filings and turnings", hazardous: false, chapter: "12", group: "12 01" },
  "12 01 04": { code: "12 01 04", description: "Non-ferrous metal dust and particles", hazardous: false, chapter: "12", group: "12 01" },
  "12 01 05": { code: "12 01 05", description: "Plastics shavings and turnings", hazardous: false, chapter: "12", group: "12 01" },
  "12 01 15*": { code: "12 01 15*", description: "Machining sludges containing dangerous substances", hazardous: true, chapter: "12", group: "12 01" },

  // Chapter 13 — Waste oils
  "13 01 09*": { code: "13 01 09*", description: "Mineral-based chlorinated hydraulic oils", hazardous: true, chapter: "13", group: "13 01" },
  "13 01 10*": { code: "13 01 10*", description: "Mineral-based non-chlorinated hydraulic oils", hazardous: true, chapter: "13", group: "13 01" },
  "13 02 05*": { code: "13 02 05*", description: "Mineral-based non-chlorinated engine, gear and lubricating oils", hazardous: true, chapter: "13", group: "13 02" },
  "13 07 01*": { code: "13 07 01*", description: "Fuel oil and diesel", hazardous: true, chapter: "13", group: "13 07" },
  "13 07 02*": { code: "13 07 02*", description: "Petrol", hazardous: true, chapter: "13", group: "13 07" },

  // Chapter 14 — Organic solvents
  "14 06 01*": { code: "14 06 01*", description: "Chlorofluorocarbons, HCFC, HFC", hazardous: true, chapter: "14", group: "14 06" },
  "14 06 03*": { code: "14 06 03*", description: "Other solvents and solvent mixtures", hazardous: true, chapter: "14", group: "14 06" },

  // Chapter 15 — Packaging
  "15 01 01": { code: "15 01 01", description: "Paper and cardboard packaging", hazardous: false, chapter: "15", group: "15 01" },
  "15 01 02": { code: "15 01 02", description: "Plastic packaging", hazardous: false, chapter: "15", group: "15 01" },
  "15 01 03": { code: "15 01 03", description: "Wooden packaging", hazardous: false, chapter: "15", group: "15 01" },
  "15 01 04": { code: "15 01 04", description: "Metallic packaging", hazardous: false, chapter: "15", group: "15 01" },
  "15 01 05": { code: "15 01 05", description: "Composite packaging", hazardous: false, chapter: "15", group: "15 01" },
  "15 01 06": { code: "15 01 06", description: "Mixed packaging", hazardous: false, chapter: "15", group: "15 01" },
  "15 01 07": { code: "15 01 07", description: "Glass packaging", hazardous: false, chapter: "15", group: "15 01" },
  "15 01 09": { code: "15 01 09", description: "Textile packaging", hazardous: false, chapter: "15", group: "15 01" },
  "15 01 10*": { code: "15 01 10*", description: "Packaging containing residues of or contaminated by dangerous substances", hazardous: true, chapter: "15", group: "15 01" },
  "15 02 02*": { code: "15 02 02*", description: "Absorbents, filter materials, wiping cloths and protective clothing contaminated by dangerous substances", hazardous: true, chapter: "15", group: "15 02" },
  "15 02 03": { code: "15 02 03", description: "Absorbents, filter materials, wiping cloths and protective clothing other than 15 02 02", hazardous: false, chapter: "15", group: "15 02" },

  // Chapter 16 — Equipment / vehicles / batteries
  "16 01 03": { code: "16 01 03", description: "End-of-life tyres", hazardous: false, chapter: "16", group: "16 01" },
  "16 01 06": { code: "16 01 06", description: "End-of-life vehicles containing neither liquids nor other hazardous components", hazardous: false, chapter: "16", group: "16 01" },
  "16 01 07*": { code: "16 01 07*", description: "Oil filters", hazardous: true, chapter: "16", group: "16 01" },
  "16 02 11*": { code: "16 02 11*", description: "Discarded equipment containing chlorofluorocarbons, HCFC, HFC", hazardous: true, chapter: "16", group: "16 02" },
  "16 02 13*": { code: "16 02 13*", description: "Discarded equipment containing hazardous components (WEEE)", hazardous: true, chapter: "16", group: "16 02" },
  "16 02 14": { code: "16 02 14", description: "Discarded equipment other than those mentioned in 16 02 09 to 16 02 13", hazardous: false, chapter: "16", group: "16 02" },
  "16 06 01*": { code: "16 06 01*", description: "Lead batteries", hazardous: true, chapter: "16", group: "16 06" },
  "16 06 02*": { code: "16 06 02*", description: "Ni-Cd batteries", hazardous: true, chapter: "16", group: "16 06" },
  "16 06 04": { code: "16 06 04", description: "Alkaline batteries (except 16 06 03)", hazardous: false, chapter: "16", group: "16 06" },
  "16 06 05": { code: "16 06 05", description: "Other batteries and accumulators", hazardous: false, chapter: "16", group: "16 06" },

  // Chapter 17 — Construction and demolition
  "17 01 01": { code: "17 01 01", description: "Concrete", hazardous: false, chapter: "17", group: "17 01" },
  "17 01 02": { code: "17 01 02", description: "Bricks", hazardous: false, chapter: "17", group: "17 01" },
  "17 01 03": { code: "17 01 03", description: "Tiles and ceramics", hazardous: false, chapter: "17", group: "17 01" },
  "17 01 06*": { code: "17 01 06*", description: "Mixtures of or separate fractions of concrete, bricks, tiles and ceramics containing dangerous substances", hazardous: true, chapter: "17", group: "17 01" },
  "17 01 07": { code: "17 01 07", description: "Mixtures of concrete, bricks, tiles and ceramics other than those mentioned in 17 01 06", hazardous: false, chapter: "17", group: "17 01" },
  "17 02 01": { code: "17 02 01", description: "Wood", hazardous: false, chapter: "17", group: "17 02" },
  "17 02 02": { code: "17 02 02", description: "Glass", hazardous: false, chapter: "17", group: "17 02" },
  "17 02 03": { code: "17 02 03", description: "Plastic", hazardous: false, chapter: "17", group: "17 02" },
  "17 02 04*": { code: "17 02 04*", description: "Glass, plastic and wood containing or contaminated with dangerous substances", hazardous: true, chapter: "17", group: "17 02" },
  "17 03 01*": { code: "17 03 01*", description: "Bituminous mixtures containing coal tar", hazardous: true, chapter: "17", group: "17 03" },
  "17 03 02": { code: "17 03 02", description: "Bituminous mixtures other than those mentioned in 17 03 01", hazardous: false, chapter: "17", group: "17 03" },
  "17 04 01": { code: "17 04 01", description: "Copper, bronze, brass", hazardous: false, chapter: "17", group: "17 04" },
  "17 04 02": { code: "17 04 02", description: "Aluminium", hazardous: false, chapter: "17", group: "17 04" },
  "17 04 04": { code: "17 04 04", description: "Zinc", hazardous: false, chapter: "17", group: "17 04" },
  "17 04 05": { code: "17 04 05", description: "Iron and steel", hazardous: false, chapter: "17", group: "17 04" },
  "17 04 07": { code: "17 04 07", description: "Mixed metals", hazardous: false, chapter: "17", group: "17 04" },
  "17 04 09*": { code: "17 04 09*", description: "Metal waste contaminated with dangerous substances", hazardous: true, chapter: "17", group: "17 04" },
  "17 04 11": { code: "17 04 11", description: "Cables other than those mentioned in 17 04 10", hazardous: false, chapter: "17", group: "17 04" },
  "17 05 03*": { code: "17 05 03*", description: "Soil and stones containing dangerous substances", hazardous: true, chapter: "17", group: "17 05" },
  "17 05 04": { code: "17 05 04", description: "Soil and stones other than those mentioned in 17 05 03", hazardous: false, chapter: "17", group: "17 05" },
  "17 05 05*": { code: "17 05 05*", description: "Dredging spoil containing dangerous substances", hazardous: true, chapter: "17", group: "17 05" },
  "17 05 06": { code: "17 05 06", description: "Dredging spoil other than those mentioned in 17 05 05", hazardous: false, chapter: "17", group: "17 05" },
  "17 06 01*": { code: "17 06 01*", description: "Insulation materials containing asbestos", hazardous: true, chapter: "17", group: "17 06" },
  "17 06 03*": { code: "17 06 03*", description: "Other insulation materials consisting of or containing dangerous substances", hazardous: true, chapter: "17", group: "17 06" },
  "17 06 04": { code: "17 06 04", description: "Insulation materials other than those mentioned in 17 06 01 and 17 06 03", hazardous: false, chapter: "17", group: "17 06" },
  "17 06 05*": { code: "17 06 05*", description: "Construction materials containing asbestos", hazardous: true, chapter: "17", group: "17 06" },
  "17 08 01*": { code: "17 08 01*", description: "Gypsum-based construction materials contaminated with dangerous substances", hazardous: true, chapter: "17", group: "17 08" },
  "17 08 02": { code: "17 08 02", description: "Gypsum-based construction materials other than those mentioned in 17 08 01", hazardous: false, chapter: "17", group: "17 08" },
  "17 09 03*": { code: "17 09 03*", description: "Other construction and demolition wastes containing dangerous substances", hazardous: true, chapter: "17", group: "17 09" },
  "17 09 04": { code: "17 09 04", description: "Mixed construction and demolition wastes other than those mentioned in 17 09 01, 17 09 02 and 17 09 03", hazardous: false, chapter: "17", group: "17 09" },

  // Chapter 18 — Healthcare
  "18 01 01": { code: "18 01 01", description: "Sharps (except 18 01 03)", hazardous: false, chapter: "18", group: "18 01" },
  "18 01 03*": { code: "18 01 03*", description: "Wastes whose collection and disposal is subject to special requirements in order to prevent infection", hazardous: true, chapter: "18", group: "18 01" },
  "18 01 04": { code: "18 01 04", description: "Wastes whose collection and disposal is not subject to special requirements in order to prevent infection", hazardous: false, chapter: "18", group: "18 01" },
  "18 01 06*": { code: "18 01 06*", description: "Chemicals consisting of or containing dangerous substances", hazardous: true, chapter: "18", group: "18 01" },

  // Chapter 19 — Waste treatment
  "19 08 01": { code: "19 08 01", description: "Screenings (wastewater treatment)", hazardous: false, chapter: "19", group: "19 08" },
  "19 08 05": { code: "19 08 05", description: "Sludges from treatment of urban waste water", hazardous: false, chapter: "19", group: "19 08" },
  "19 12 01": { code: "19 12 01", description: "Paper and cardboard (waste treatment)", hazardous: false, chapter: "19", group: "19 12" },
  "19 12 02": { code: "19 12 02", description: "Ferrous metal (waste treatment)", hazardous: false, chapter: "19", group: "19 12" },
  "19 12 03": { code: "19 12 03", description: "Non-ferrous metal (waste treatment)", hazardous: false, chapter: "19", group: "19 12" },
  "19 12 04": { code: "19 12 04", description: "Plastic and rubber (waste treatment)", hazardous: false, chapter: "19", group: "19 12" },
  "19 12 07": { code: "19 12 07", description: "Wood other than that mentioned in 19 12 06", hazardous: false, chapter: "19", group: "19 12" },
  "19 12 08": { code: "19 12 08", description: "Textiles (waste treatment)", hazardous: false, chapter: "19", group: "19 12" },
  "19 12 09": { code: "19 12 09", description: "Minerals (e.g. sand, rocks)", hazardous: false, chapter: "19", group: "19 12" },
  "19 12 12": { code: "19 12 12", description: "Other wastes from mechanical treatment of waste (including mixtures of materials)", hazardous: false, chapter: "19", group: "19 12" },

  // Chapter 20 — Municipal / mixed waste
  "20 01 01": { code: "20 01 01", description: "Paper and cardboard", hazardous: false, chapter: "20", group: "20 01" },
  "20 01 02": { code: "20 01 02", description: "Glass", hazardous: false, chapter: "20", group: "20 01" },
  "20 01 08": { code: "20 01 08", description: "Biodegradable kitchen and canteen waste", hazardous: false, chapter: "20", group: "20 01" },
  "20 01 10": { code: "20 01 10", description: "Clothes", hazardous: false, chapter: "20", group: "20 01" },
  "20 01 11": { code: "20 01 11", description: "Textiles", hazardous: false, chapter: "20", group: "20 01" },
  "20 01 13*": { code: "20 01 13*", description: "Solvents", hazardous: true, chapter: "20", group: "20 01" },
  "20 01 14*": { code: "20 01 14*", description: "Acids", hazardous: true, chapter: "20", group: "20 01" },
  "20 01 15*": { code: "20 01 15*", description: "Alkalines", hazardous: true, chapter: "20", group: "20 01" },
  "20 01 17*": { code: "20 01 17*", description: "Photochemicals", hazardous: true, chapter: "20", group: "20 01" },
  "20 01 19*": { code: "20 01 19*", description: "Pesticides", hazardous: true, chapter: "20", group: "20 01" },
  "20 01 21*": { code: "20 01 21*", description: "Fluorescent tubes and other mercury-containing waste", hazardous: true, chapter: "20", group: "20 01" },
  "20 01 23*": { code: "20 01 23*", description: "Discarded equipment containing chlorofluorocarbons", hazardous: true, chapter: "20", group: "20 01" },
  "20 01 25": { code: "20 01 25", description: "Edible oil and fat", hazardous: false, chapter: "20", group: "20 01" },
  "20 01 26*": { code: "20 01 26*", description: "Oil and fat other than those mentioned in 20 01 25", hazardous: true, chapter: "20", group: "20 01" },
  "20 01 27*": { code: "20 01 27*", description: "Paint, inks, adhesives and resins containing dangerous substances", hazardous: true, chapter: "20", group: "20 01" },
  "20 01 28": { code: "20 01 28", description: "Paint, inks, adhesives and resins other than those mentioned in 20 01 27", hazardous: false, chapter: "20", group: "20 01" },
  "20 01 29*": { code: "20 01 29*", description: "Detergents containing dangerous substances", hazardous: true, chapter: "20", group: "20 01" },
  "20 01 30": { code: "20 01 30", description: "Detergents other than those mentioned in 20 01 29", hazardous: false, chapter: "20", group: "20 01" },
  "20 01 31*": { code: "20 01 31*", description: "Cytotoxic and cytostatic medicines", hazardous: true, chapter: "20", group: "20 01" },
  "20 01 32": { code: "20 01 32", description: "Medicines other than those mentioned in 20 01 31", hazardous: false, chapter: "20", group: "20 01" },
  "20 01 33*": { code: "20 01 33*", description: "Batteries and accumulators — included in 16 06 01, 16 06 02 or 16 06 03 and unsorted mixtures containing such batteries", hazardous: true, chapter: "20", group: "20 01" },
  "20 01 34": { code: "20 01 34", description: "Batteries and accumulators other than those mentioned in 20 01 33", hazardous: false, chapter: "20", group: "20 01" },
  "20 01 35*": { code: "20 01 35*", description: "Discarded electrical and electronic equipment other than those mentioned in 20 01 21 and 20 01 23 containing hazardous components", hazardous: true, chapter: "20", group: "20 01" },
  "20 01 36": { code: "20 01 36", description: "Discarded electrical and electronic equipment other than those mentioned in 20 01 21, 20 01 23 and 20 01 35", hazardous: false, chapter: "20", group: "20 01" },
  "20 01 37*": { code: "20 01 37*", description: "Wood containing dangerous substances", hazardous: true, chapter: "20", group: "20 01" },
  "20 01 38": { code: "20 01 38", description: "Wood other than that mentioned in 20 01 37", hazardous: false, chapter: "20", group: "20 01" },
  "20 01 39": { code: "20 01 39", description: "Plastics", hazardous: false, chapter: "20", group: "20 01" },
  "20 01 40": { code: "20 01 40", description: "Metals", hazardous: false, chapter: "20", group: "20 01" },
  "20 01 41": { code: "20 01 41", description: "Wastes from chimney sweeping", hazardous: false, chapter: "20", group: "20 01" },
  "20 01 99": { code: "20 01 99", description: "Other fractions not otherwise specified", hazardous: false, chapter: "20", group: "20 01" },
  "20 02 01": { code: "20 02 01", description: "Biodegradable waste (garden)", hazardous: false, chapter: "20", group: "20 02" },
  "20 02 02": { code: "20 02 02", description: "Soil and stones", hazardous: false, chapter: "20", group: "20 02" },
  "20 02 03": { code: "20 02 03", description: "Other non-biodegradable waste", hazardous: false, chapter: "20", group: "20 02" },
  "20 03 01": { code: "20 03 01", description: "Mixed municipal waste", hazardous: false, chapter: "20", group: "20 03" },
  "20 03 02": { code: "20 03 02", description: "Waste from markets", hazardous: false, chapter: "20", group: "20 03" },
  "20 03 03": { code: "20 03 03", description: "Street-cleaning residues", hazardous: false, chapter: "20", group: "20 03" },
  "20 03 04": { code: "20 03 04", description: "Septic tank sludge", hazardous: false, chapter: "20", group: "20 03" },
  "20 03 06": { code: "20 03 06", description: "Waste from sewage cleaning", hazardous: false, chapter: "20", group: "20 03" },
  "20 03 07": { code: "20 03 07", description: "Bulky waste", hazardous: false, chapter: "20", group: "20 03" },
  "20 03 99": { code: "20 03 99", description: "Municipal wastes not otherwise specified", hazardous: false, chapter: "20", group: "20 03" },
};

/** Normalise an EWC code to the canonical "XX XX XX" or "XX XX XX*" format. */
export function normaliseEwcCode(code: string): string {
  // Strip spaces, asterisks, then reformat
  const stripped = code.replace(/\s/g, "").replace(/\*/g, "");
  if (stripped.length < 6) return code.trim().toUpperCase();
  const formatted = `${stripped.slice(0, 2)} ${stripped.slice(2, 4)} ${stripped.slice(4, 6)}`;
  // Preserve asterisk if original had one
  return code.includes("*") ? `${formatted}*` : formatted;
}

/** Look up an EWC entry. Accepts codes with or without spaces/asterisks. */
export function lookupEwcCode(code: string): EwcEntry | undefined {
  const normalised = normaliseEwcCode(code);
  return EWC_CODES[normalised] ?? EWC_CODES[normalised.replace(/\*$/, "")];
}

/**
 * Returns true if the EWC code is in the UK hazardous waste list.
 * Codes ending in * are always hazardous; unlisted codes return false.
 */
export function isHazardousEwc(code: string): boolean {
  const normalised = normaliseEwcCode(code);
  if (normalised.endsWith("*")) return true;
  const entry = EWC_CODES[normalised];
  return entry?.hazardous ?? false;
}

/**
 * Returns true if the code is a recognised EWC code in this reference list.
 * A "valid" code passes format validation — 6 digits in XX XX XX pattern.
 */
export function validateEwcCode(code: string): { valid: boolean; known: boolean; hazardous: boolean; description?: string } {
  const normalised = normaliseEwcCode(code);
  const formatOk = /^\d{2} \d{2} \d{2}\*?$/.test(normalised);
  if (!formatOk) return { valid: false, known: false, hazardous: false };
  const entry = lookupEwcCode(normalised);
  return {
    valid: true,
    known: !!entry,
    hazardous: isHazardousEwc(normalised),
    description: entry?.description,
  };
}

/** Sorted list of all known EWC codes — useful for a type-ahead picker. */
export function listEwcCodes(): EwcEntry[] {
  return Object.values(EWC_CODES).sort((a, b) => a.code.localeCompare(b.code));
}
