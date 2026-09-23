// Embodied carbon from delivery notes. When a reviewer approves a delivery
// note captured in the field app, the material on it is matched to the
// embodied carbon library (or the supplier's own EPD) and recorded against the
// site's project: A1-A3 from the material factor, and A4 from the actual
// delivery, using the route distance the app captured and DEFRA's HGV
// tonne.km factor instead of a generic transport assumption.
//
// Nothing is guessed: a material the library does not hold (topsoil, sand
// when named on its own), or a quantity that cannot be converted to the material's unit
// (bags, pallets, m2 of a per-kg product), produces no record and says why.

import type { EmbodiedMaterial, EpdRecord, Prisma } from "@prisma/client";
import { calculateEmbodiedCarbon, type MaterialGwpFactors } from "./engine";
import { chooseFactorLibrary, currentFactorLibraries } from "@/lib/calculation/library-for-period";

type Material = Pick<EmbodiedMaterial, "id" | "name" | "category" | "declaredUnit" | "density">;

// Delivered materials with no factor in the library, checked before the
// ordinary rules so they are reported rather than filed as something else.
const NOT_IN_LIBRARY = /\b(topsoil|subsoil|soils?|turf|mulch|bark)\b/i;

const RECYCLED = /\b(recycled|reclaimed|secondary|rca|rap|planings|crushed concrete|6f[1-5])\b/i;
const AGGREGATE = /\b(aggregates?|type ?[13]|mot|sub[- ]?base|sand|gravel|ballast|scalpings|hardcore|grit|shingle|crushed (rock|concrete)|limestone|granite|6f[1-5])\b/i;
const ASPHALT = /\b(asphalt|tarmac|macadam|bitmac|dbm|hra|sma|ac ?\d{1,2}|surface course|binder course|base course|planings)\b/i;

// Most specific first. Where the note does not say which grade or route
// (virgin or recycled steel, primary or recycled aluminium), the higher
// factor is used so the figure is not understated; a supplier EPD replaces it.
// `strong` rules name the product unambiguously and win even when the note
// also mentions an unmatched material ("C32/40 ready-mix, 20mm aggregate").
// `when`, if set, must also match (recycled variants).
const RULES: { test: RegExp; when?: RegExp; material: string; note?: string; strong?: boolean }[] = [
  { test: /\b(rebar|reinforc\w*|b500\w*|a393|a252|a142|steel mesh)\b/i, material: "Reinforcing Bar (rebar, recycled)", strong: true },
  { test: /\b(ready[- ]?mix\w*|readymix|c\d{2}\/\d{2}|gen ?[0-3]|st[1-5]|rc ?\d{2}(\/\d{2})?)\b/i, material: "Ready Mix Concrete (25 MPa, 300 kg/m3 cement)", note: "mix design not matched, so a C25-class ready-mix factor was used", strong: true },
  { test: /\b(aircrete|aac|thermalite|celcon|aerated)\b/i, material: "Aerated Concrete Block (AAC)", strong: true },
  { test: /\b(dense |concrete |aggregate )?blocks?\b/i, material: "Dense Aggregate Block", strong: true },
  { test: ASPHALT, when: RECYCLED, material: "Asphalt (recycled content)", strong: true },
  { test: ASPHALT, material: "Asphalt (primary)", note: "recycled content not stated, so the primary asphalt factor was used", strong: true },
  { test: AGGREGATE, when: RECYCLED, material: "Aggregates (recycled)", strong: true },
  { test: AGGREGATE, material: "Aggregates (primary)", note: "recycled content not stated, so the primary aggregate factor was used", strong: true },
  { test: /\bstainless\b/i, material: "Stainless Steel 304" },
  { test: /\b(cold[- ]?rolled|steel sheet|purlins?|steel decking)\b/i, material: "Cold-Rolled Steel Sheet" },
  { test: /\b(ub|uc|pfc|rsj|universal (beam|column)s?|structural steel|steel (beams?|columns?|sections?))\b/i, material: "Structural Steel (virgin, UK EAF)", note: "steel route not stated, so the higher virgin-steel factor was used" },
  { test: /\bprecast\b/i, material: "Precast Concrete Panel" },
  { test: /\broof ?tiles?\b/i, material: "Concrete Roof Tile" },
  { test: /\bconcrete\b/i, material: "Ready Mix Concrete (25 MPa, 300 kg/m3 cement)", note: "mix design not matched, so a C25-class ready-mix factor was used" },
  { test: /\b(cem ?i|cement|opc)\b/i, material: "General Purpose Cement (CEM I)" },
  { test: /\bbricks?\b/i, material: "Facing Brick" },
  { test: /\b(clt|cross[- ]laminated)\b/i, material: "Cross-Laminated Timber (CLT)" },
  { test: /\b(glulam|glued laminated)\b/i, material: "Glued Laminated Timber (Glulam)" },
  { test: /\b(osb|sterling ?board)\b/i, material: "Oriented Strand Board (OSB)" },
  { test: /\b(plywood|ply)\b/i, material: "Plywood" },
  { test: /\b(timber|c16|c24|cls|softwood|joists?|battens?|studs?)\b/i, material: "Sawn Softwood Timber (kiln dried)" },
  { test: /\b(pir|pur|kingspan|celotex|recticel|ecotherm)\b/i, material: "Rigid PIR / PUR Board" },
  { test: /\b(xps|extruded polystyrene)\b/i, material: "Extruded Polystyrene (XPS)" },
  { test: /\b(eps|expanded polystyrene|jablite)\b/i, material: "Expanded Polystyrene (EPS)" },
  { test: /\b(rock ?wool|stone ?wool)\b/i, material: "Mineral Wool (rock)" },
  { test: /\b(glass ?wool|mineral wool|isover|loft roll)\b/i, material: "Mineral Wool (glass)" },
  { test: /\b(plasterboard|gyproc|gypsum board|drywall)\b/i, material: "Plasterboard (standard)" },
  { test: /\b(plaster|multi[- ]?finish|bonding coat)\b/i, material: "Gypsum Plaster" },
  { test: /\bcopper\b/i, material: "Copper Pipe" },
  { test: /\b(hdpe|mdpe|polyethylene|ducting)\b/i, material: "HDPE Pipe" },
  { test: /\b(pvc|upvc|pvc-u)\b/i, material: "PVC-U Pipe" },
  { test: /\b(ceramic|porcelain|floor tiles?)\b/i, material: "Ceramic Floor Tile" },
  { test: /\bcarpet\b/i, material: "Carpet (nylon, broadloom)" },
  { test: /\b(aluminium|aluminum)\b/i, material: "Aluminium (primary, smelted)", note: "aluminium route not stated, so the higher primary factor was used" },
  { test: /\bglass\b/i, material: "Float Glass" },
];

export type MaterialMatch = { material: Material; reason: string } | { material: null; reason: string };

/** The library material a delivery note's description refers to. */
export function matchMaterial(text: string, materials: Material[]): MaterialMatch {
  const t = text.trim();
  if (!t) return { material: null, reason: "The delivery note has no material description." };
  const byName = new Map(materials.map((m) => [m.name, m]));
  const first = (rules: typeof RULES): MaterialMatch | null => {
    for (const rule of rules) {
      const hit = t.match(rule.test);
      if (!hit || (rule.when && !rule.when.test(t))) continue;
      const material = byName.get(rule.material);
      if (material) return { material, reason: `"${hit[0]}" matched ${material.name}${rule.note ? `; ${rule.note}` : ""}` };
    }
    return null;
  };
  const strong = first(RULES.filter((r) => r.strong));
  if (strong) return strong;
  const missing = t.match(NOT_IN_LIBRARY);
  if (missing) return { material: null, reason: `The material library has no factor for "${missing[0]}".` };
  const any = first(RULES);
  if (any) return any;
  return { material: null, reason: `No library material matches "${t.slice(0, 60)}".` };
}

const UNIT_ALIASES: Record<string, "kg" | "tonne" | "m3" | "m2"> = {
  kg: "kg", kgs: "kg", kilogram: "kg", kilograms: "kg",
  t: "tonne", tonne: "tonne", tonnes: "tonne", ton: "tonne", tons: "tonne", te: "tonne",
  m3: "m3", "m³": "m3", cum: "m3", "cu m": "m3", "cubic metre": "m3", "cubic metres": "m3", "cubic meters": "m3",
  m2: "m2", "m²": "m2", sqm: "m2", "sq m": "m2", "square metres": "m2",
};

export function canonicalUnit(unit: string): "kg" | "tonne" | "m3" | "m2" | null {
  return UNIT_ALIASES[unit.trim().toLowerCase()] ?? null;
}

/** Delivered mass in kg, when it can be known. */
export function deliveredMassKg(quantity: number, unit: "kg" | "tonne" | "m3" | "m2", density: number | null | undefined): number | null {
  if (unit === "kg") return quantity;
  if (unit === "tonne") return quantity * 1000;
  if (unit === "m3" && density) return quantity * density;
  return null;
}

/** Whether the engine can express this quantity in the factor's declared unit without guessing. */
export function convertible(unit: "kg" | "tonne" | "m3" | "m2", declaredUnit: string, density: number | null | undefined): boolean {
  const declared = declaredUnit.toLowerCase();
  if (declared === "kg") return unit === "kg" || unit === "tonne" || (unit === "m3" && !!density);
  if (declared === "m3") return unit === "m3" || ((unit === "kg" || unit === "tonne") && !!density);
  if (declared === "m2") return unit === "m2";
  return unit === declared;
}

export type HgvFactor = { externalId: string; kgCo2ePerTonneKm: number; library: string };

export type DeliveryEmbodiedResult =
  | {
      ok: true;
      quantity: number;
      unit: "kg" | "tonne" | "m3" | "m2";
      a1a3Kg: number;
      a4Kg: number | null;
      gwpA1A3Used: number;
      gwpA4Used: number | null;
      totalKgCo2e: number;
      stages: string[];
      notes: string;
    }
  | { ok: false; reason: string };

/**
 * A1-A3 from the material (or EPD) factor; A4 from the actual delivery
 * (tonnes x route km x HGV factor) when the route and mass are known,
 * otherwise the factor's generic A4 if it has one.
 */
export function computeDeliveryEmbodied(input: {
  quantity: number;
  unit: string;
  factors: MaterialGwpFactors;
  factorSource: string;
  distanceKm: number | null;
  hgv: HgvFactor | null;
}): DeliveryEmbodiedResult {
  const unit = canonicalUnit(input.unit);
  if (!unit) return { ok: false, reason: `"${input.unit}" is not a mass, volume or area, so embodied carbon cannot be calculated. Record the delivered weight or volume.` };
  if (!(input.quantity > 0)) return { ok: false, reason: "The delivered quantity is missing." };
  const { factors } = input;
  if (!convertible(unit, factors.declaredUnit, factors.density)) {
    return { ok: false, reason: `The factor is per ${factors.declaredUnit} and the delivery is in ${unit}, with no density to convert between them.` };
  }

  const a13 = calculateEmbodiedCarbon({ quantity: input.quantity, unit, factors, stages: ["A1-A3"] });
  const a1a3Kg = a13.totalKgCo2e;
  const declaredQty = a13.quantityKg; // quantity in the declared unit
  const notes = [`A1-A3: ${declaredQty.toFixed(3)} ${factors.declaredUnit} x ${factors.gwpA1A3} kgCO2e/${factors.declaredUnit} (${input.factorSource}) = ${a1a3Kg.toFixed(2)} kgCO2e`];

  let a4Kg: number | null = null;
  const massKg = deliveredMassKg(input.quantity, unit, factors.density);
  if (input.distanceKm && input.distanceKm > 0 && massKg != null && input.hgv) {
    a4Kg = (massKg / 1000) * input.distanceKm * input.hgv.kgCo2ePerTonneKm;
    notes.push(
      `A4 (actual delivery): ${(massKg / 1000).toFixed(3)} t x ${input.distanceKm.toFixed(1)} km x ${input.hgv.kgCo2ePerTonneKm} kgCO2e/tonne.km (${input.hgv.library}, ${input.hgv.externalId}) = ${a4Kg.toFixed(2)} kgCO2e`,
    );
  } else if (factors.gwpA4 != null) {
    a4Kg = declaredQty * factors.gwpA4;
    notes.push(`A4 (generic, no delivery route recorded): ${declaredQty.toFixed(3)} x ${factors.gwpA4} = ${a4Kg.toFixed(2)} kgCO2e`);
  } else {
    notes.push("A4 not included: no delivery route was recorded and the factor has no transport value.");
  }

  return {
    ok: true,
    quantity: input.quantity,
    unit,
    a1a3Kg,
    a4Kg,
    gwpA1A3Used: factors.gwpA1A3,
    gwpA4Used: a4Kg != null && declaredQty > 0 ? a4Kg / declaredQty : null,
    totalKgCo2e: a1a3Kg + (a4Kg ?? 0),
    stages: a4Kg != null ? ["A1-A3", "A4"] : ["A1-A3"],
    notes: notes.join("\n"),
  };
}

const norm = (s: string) => s.toLowerCase().replace(/\b(ltd|limited|plc|uk|group)\b|[^a-z0-9]/g, "");

/** A supplier's own EPD for this material, valid on the delivery date. */
export function pickSupplierEpd<T extends Pick<EpdRecord, "materialId" | "manufacturer" | "validFrom" | "validUntil">>(
  epds: T[],
  materialId: string,
  supplierName: string | null,
  date: Date,
): T | null {
  if (!supplierName || !norm(supplierName)) return null;
  const supplier = norm(supplierName);
  return (
    epds.find((e) => {
      if (e.materialId !== materialId || !e.manufacturer) return false;
      if (e.validFrom && e.validFrom > date) return false;
      if (e.validUntil && e.validUntil < date) return false;
      const maker = norm(e.manufacturer);
      return !!maker && (maker.includes(supplier) || supplier.includes(maker));
    }) ?? null
  );
}

export const deliveryDescription = (formData: Record<string, unknown>) =>
  String(formData["materialType"] ?? formData["material"] ?? formData["description"] ?? "").trim();

export type EmbodiedOutcome = { recordId: string; totalKgCo2e: number; materialName: string } | { recordId: null; reason: string };

/**
 * Creates the EmbodiedCarbonRecord for an approved delivery note, inside the
 * approval transaction. `materialId` undefined = match automatically, null =
 * the reviewer chose not to record embodied carbon.
 */
export async function recordDeliveryEmbodiedCarbon(
  tx: Prisma.TransactionClient,
  opts: {
    orgId: string;
    submission: {
      id: string;
      siteId: string | null;
      reportingPeriodId: string;
      calculatedDistanceKm: Prisma.Decimal | number | null;
    };
    formData: Record<string, unknown>;
    quantity: number;
    unit: string;
    activityDate: Date;
    materialId?: string | null;
    userId: string;
  },
): Promise<EmbodiedOutcome> {
  if (opts.materialId === null) return { recordId: null, reason: "The reviewer chose not to record embodied carbon." };

  const existing = await tx.embodiedCarbonRecord.findFirst({
    where: { organizationId: opts.orgId, fieldSubmissionId: opts.submission.id },
    select: { id: true, totalKgCo2e: true },
  });
  if (existing) return { recordId: existing.id, totalKgCo2e: existing.totalKgCo2e, materialName: "" };

  const materials = await tx.embodiedMaterial.findMany({
    select: { id: true, name: true, category: true, declaredUnit: true, density: true, gwpA1A3: true, gwpA4: true, gwpA5: true, gwpC1C4: true, gwpC1: true, gwpC2: true, gwpC3: true, gwpC4: true, gwpD: true, source: true },
  });
  const description = deliveryDescription(opts.formData);
  let material: (typeof materials)[number] | undefined;
  let reason: string;
  if (opts.materialId) {
    material = materials.find((m) => m.id === opts.materialId);
    if (!material) return { recordId: null, reason: "The chosen material is not in the library." };
    reason = `chosen by the reviewer`;
  } else {
    const match = matchMaterial(description, materials);
    if (!match.material) return { recordId: null, reason: match.reason };
    material = materials.find((m) => m.id === match.material!.id)!;
    reason = match.reason;
  }

  const supplierName = opts.formData["supplierName"] ? String(opts.formData["supplierName"]) : null;
  const epds = await tx.epdRecord.findMany({ where: { organizationId: opts.orgId, materialId: material.id } });
  const epd = pickSupplierEpd(epds, material.id, supplierName, opts.activityDate);
  const factors: MaterialGwpFactors = epd
    ? { ...epd, density: material.density }
    : { ...material };
  const factorSource = epd ? `EPD: ${epd.productName}${epd.manufacturer ? `, ${epd.manufacturer}` : ""}` : `${material.name}, ${material.source}`;

  const libraries = currentFactorLibraries(await tx.factorLibrary.findMany({ select: { id: true, name: true, version: true } }));
  const library = chooseFactorLibrary(libraries, opts.activityDate);
  const hgvRow = library
    ? await tx.emissionFactor.findFirst({
        where: { factorLibraryId: library.id, externalId: { endsWith: "-hgv-avg-tkm" }, inputUnit: "tonne.km" },
        select: { externalId: true, co2e: true },
      })
    : null;
  const hgv = hgvRow?.co2e != null && library
    ? { externalId: hgvRow.externalId!, kgCo2ePerTonneKm: Number(hgvRow.co2e), library: `${library.name} ${library.version}` }
    : null;

  const distance = opts.submission.calculatedDistanceKm != null ? Number(opts.submission.calculatedDistanceKm) : null;
  const result = computeDeliveryEmbodied({ quantity: opts.quantity, unit: opts.unit, factors, factorSource, distanceKm: distance, hgv });
  if (!result.ok) return { recordId: null, reason: result.reason };

  const site = opts.submission.siteId
    ? await tx.site.findFirst({ where: { id: opts.submission.siteId, organizationId: opts.orgId }, select: { projectId: true } })
    : null;

  const record = await tx.embodiedCarbonRecord.create({
    data: {
      organizationId: opts.orgId,
      projectId: site?.projectId ?? null,
      reportingPeriodId: opts.submission.reportingPeriodId,
      materialId: material.id,
      epdId: epd?.id ?? null,
      description: [description || material.name, supplierName].filter(Boolean).join(" · ").slice(0, 500),
      quantity: result.quantity,
      unit: result.unit,
      gwpA1A3Used: result.gwpA1A3Used,
      gwpA4Used: result.gwpA4Used,
      totalKgCo2e: result.totalKgCo2e,
      lifecycleStages: result.stages,
      source: "delivery_note",
      fieldSubmissionId: opts.submission.id,
      notes: `Material ${reason}.\n${result.notes}`,
      createdByUserId: opts.userId,
    },
    select: { id: true },
  });
  return { recordId: record.id, totalKgCo2e: result.totalKgCo2e, materialName: material.name };
}
