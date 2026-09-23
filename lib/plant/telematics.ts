// Telematics input. Two shapes:
// - ISO 15143-3 (AEMP 2.0) fleet snapshots, the format Cat, Komatsu, JCB,
//   Volvo, Hitachi and most mixed-fleet providers expose. Counters are
//   cumulative, so each snapshot is differenced against the machine's last one.
// - Period rows (a provider's CSV or daily export), already per period.
import { z } from "zod";

const counter = z.object({ datetime: z.string().optional(), Hour: z.coerce.number().optional() }).passthrough();
const fuel = z
  .object({ datetime: z.string().optional(), FuelUnits: z.string().optional(), FuelConsumed: z.coerce.number().optional() })
  .passthrough();

export const iso15143Snapshot = z
  .object({
    SnapshotTime: z.string().optional(),
    Equipment: z
      .array(
        z
          .object({
            EquipmentHeader: z
              .object({
                OEMName: z.string().optional(),
                Model: z.string().optional(),
                EquipmentID: z.string().optional(),
                SerialNumber: z.string().optional(),
                PIN: z.string().optional(),
              })
              .passthrough(),
            CumulativeOperatingHours: counter.optional(),
            CumulativeIdleHours: counter.optional(),
            FuelUsed: fuel.optional(),
          })
          .passthrough(),
      )
      .max(2000),
  })
  .passthrough();
export type Iso15143Snapshot = z.infer<typeof iso15143Snapshot>;

export const periodRow = z.object({
  serialNumber: z.string().trim().min(1).max(100),
  name: z.string().trim().max(200).optional(),
  make: z.string().trim().max(100).optional(),
  model: z.string().trim().max(100).optional(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  operatingHours: z.coerce.number().min(0).max(10_000).optional(),
  idleHours: z.coerce.number().min(0).max(10_000).optional(),
  fuelLitres: z.coerce.number().min(0).max(10_000_000).optional(),
  idleFuelLitres: z.coerce.number().min(0).max(10_000_000).optional(),
}).refine((r) => r.periodEnd > r.periodStart, { message: "periodEnd must be after periodStart", path: ["periodEnd"] });
export type PeriodRow = z.infer<typeof periodRow>;

/** Cumulative counters for one machine at one time. */
export type Cumulative = {
  serialNumber: string;
  name: string;
  make?: string;
  model?: string;
  at: Date;
  hours: number | null;
  idleHours: number | null;
  fuelLitres: number | null;
};

const GALLON_US = 3.785411784;
function litres(f: { FuelUnits?: string; FuelConsumed?: number } | undefined): number | null {
  if (!f || f.FuelConsumed == null || !Number.isFinite(f.FuelConsumed)) return null;
  const unit = (f.FuelUnits ?? "litre").toLowerCase();
  if (unit.startsWith("l")) return f.FuelConsumed;
  if (unit.startsWith("gal")) return f.FuelConsumed * GALLON_US;
  return null;
}

/** One cumulative reading per machine that has an identifier and a time. */
export function snapshotCumulatives(s: Iso15143Snapshot): { readings: Cumulative[]; skipped: string[] } {
  const readings: Cumulative[] = [];
  const skipped: string[] = [];
  for (const e of s.Equipment) {
    const h = e.EquipmentHeader;
    const serial = (h.SerialNumber || h.PIN || h.EquipmentID || "").trim();
    const when = e.CumulativeOperatingHours?.datetime ?? e.FuelUsed?.datetime ?? s.SnapshotTime;
    const at = when ? new Date(when) : null;
    if (!serial || !at || Number.isNaN(at.getTime())) {
      skipped.push(serial || h.Model || "unidentified machine");
      continue;
    }
    readings.push({
      serialNumber: serial,
      name: [h.OEMName, h.Model].filter(Boolean).join(" ") || serial,
      make: h.OEMName,
      model: h.Model,
      at,
      hours: e.CumulativeOperatingHours?.Hour ?? null,
      idleHours: e.CumulativeIdleHours?.Hour ?? null,
      fuelLitres: litres(e.FuelUsed),
    });
  }
  return { readings, skipped };
}

/**
 * The period between two cumulative readings. A counter that went backwards
 * (meter replaced or reset) gives no value for that measure rather than a
 * negative or invented one.
 */
export function differenceReadings(
  prev: { at: Date; hours: number | null; idleHours: number | null; fuelLitres: number | null } | null,
  cur: Cumulative,
): { periodStart: Date; periodEnd: Date; operatingHours: number | null; idleHours: number | null; fuelLitres: number | null } | null {
  if (!prev || cur.at <= prev.at) return null;
  const d = (a: number | null, b: number | null) => (a != null && b != null && a >= b ? a - b : null);
  return {
    periodStart: prev.at,
    periodEnd: cur.at,
    operatingHours: d(cur.hours, prev.hours),
    idleHours: d(cur.idleHours, prev.idleHours),
    fuelLitres: d(cur.fuelLitres, prev.fuelLitres),
  };
}
