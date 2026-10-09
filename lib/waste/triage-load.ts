import { prisma } from "@/lib/db";
import { carrierDefaults, periodFor, triageDocument, type PastLoad, type Triage } from "@/lib/waste/triage";

type Doc = { id: string; kind: string; wasteRecordId: string | null; reference: string | null; issuer: string | null; projectId: string | null; extracted: unknown };

/** Triage for a set of documents, everything read inside the organisation (three queries however many documents). */
export async function loadTriage(orgId: string, docs: Doc[]): Promise<Map<string, Triage>> {
  const notes = docs.filter((d) => d.kind === "transfer_note" && !d.wasteRecordId);
  const out = new Map<string, Triage>();
  if (notes.length === 0) return out;
  const readings = notes.map((d) => (d.extracted ?? null) as Triage["suggestion"] & { carrierRegistration?: string; carrier?: string; reference?: string } | null);
  const regs = [...new Set(readings.map((r) => r?.carrierRegistration).filter((x): x is string => !!x))];
  const names = [...new Set(notes.map((d, i) => d.issuer ?? readings[i]?.carrier).filter((x): x is string => !!x))];
  const refs = [...new Set(notes.map((d, i) => d.reference ?? readings[i]?.reference).filter((x): x is string => !!x))];
  const [past, periods, dups] = await Promise.all([
    regs.length + names.length === 0 ? [] : prisma.wasteRecord.findMany({
      where: { organizationId: orgId, OR: [...(regs.length ? [{ carrierRegistration: { in: regs, mode: "insensitive" as const } }] : []), ...(names.length ? [{ carrierName: { in: names, mode: "insensitive" as const } }] : [])] },
      select: { carrierRegistration: true, carrierName: true, ewcCode: true, facilityId: true, wasteType: true, disposalRoute: true, hazardous: true, destination: true, weightTonnes: true, recordedAt: true },
      orderBy: { recordedAt: "desc" },
      take: 3000,
    }),
    prisma.reportingPeriod.findMany({ where: { organizationId: orgId }, select: { id: true, startDate: true, endDate: true } }),
    refs.length === 0 ? [] : prisma.wasteRecord.findMany({ where: { organizationId: orgId, transferNoteReference: { in: refs, mode: "insensitive" } }, select: { transferNoteReference: true } }),
  ]);
  const history: PastLoad[] = past.map((p) => ({ ...p, weightTonnes: Number(p.weightTonnes) }));
  const seen = new Set(dups.map((d) => (d.transferNoteReference ?? "").toLowerCase()));
  notes.forEach((d, i) => {
    const r = readings[i] as (Triage["suggestion"] & { carrierRegistration?: string; carrier?: string; reference?: string; ewc?: string; date?: string }) | null;
    const ref = d.reference ?? r?.reference;
    out.set(d.id, triageDocument({
      doc: { ...d, extracted: (d.extracted ?? null) as never },
      defaults: r ? carrierDefaults(history, { registration: r.carrierRegistration, name: d.issuer ?? r.carrier }, r.ewc) : null,
      periodId: periodFor(periods, r?.date),
      duplicateReference: !!ref && seen.has(ref.toLowerCase()),
    }));
  });
  return out;
}
