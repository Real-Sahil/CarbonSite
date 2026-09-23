// Waste duty of care (Environmental Protection Act 1990 s34 and the Waste
// (England and Wales) Regulations 2011): every transfer needs a registered
// carrier, a correctly coded description (List of Waste / EWC code) and a
// transfer note, or a consignment note for hazardous waste, kept for two
// years (three for consignment notes). These checks run on each waste record
// so gaps show up before an Environment Agency audit, not during one.

export type DutyOfCareIssue = { level: "error" | "warning"; code: string; message: string };

export type WasteTransferInput = {
  recordedAt: Date;
  hazardous: boolean;
  ewcCode: string | null;
  carrierName: string | null;
  carrierRegistration: string | null;
  transferNoteReference: string | null;
  destination: string | null;
};

/** Carrier registrations the org holds on file (supplier profiles). */
export type KnownCarrier = { registration: string; expiresAt: Date | null; name: string | null };

export type DutyOfCareResult = {
  issues: DutyOfCareIssue[];
  complete: boolean;
  /** Date the transfer or consignment note may be discarded. */
  keepUntil: Date;
  ewcCode: string | null;
  carrier: { tier: "upper" | "lower" | "scotland" | "northern_ireland" | "unknown" | null; onFile: boolean };
};

/** "17 01 07", "17.01.07*" → "170107", "170107*". Null when not a List of Waste code. */
export function normaliseEwc(code: string | null): string | null {
  if (!code) return null;
  const c = code.replace(/[\s.\-]/g, "");
  if (!/^\d{6}\*?$/.test(c)) return null;
  const chapter = Number(c.slice(0, 2));
  return chapter >= 1 && chapter <= 20 ? c : null;
}

export function formatEwc(code: string): string {
  return `${code.slice(0, 2)} ${code.slice(2, 4)} ${code.slice(4, 6)}${code.endsWith("*") ? "*" : ""}`;
}

export const normaliseRegistration = (r: string) => r.toUpperCase().replace(/\s+/g, "");

/** Tier from the registration number's prefix (EA/NRW CBDU/CBDL, SEPA WCR, NIEA ROC). */
export function carrierTier(registration: string): DutyOfCareResult["carrier"]["tier"] {
  const r = normaliseRegistration(registration);
  if (/^CBDU\d{3,}$/.test(r)) return "upper";
  if (/^CBDL\d{3,}$/.test(r)) return "lower";
  if (/^WCR\/?R\/?\d+$/.test(r) || /^SCO\d+/.test(r)) return "scotland";
  if (/^ROC(UT|LT)\d+$/.test(r)) return "northern_ireland";
  return "unknown";
}

function addYears(d: Date, years: number): Date {
  const out = new Date(d);
  out.setUTCFullYear(out.getUTCFullYear() + years);
  return out;
}

export function checkDutyOfCare(t: WasteTransferInput, carriers: KnownCarrier[]): DutyOfCareResult {
  const issues: DutyOfCareIssue[] = [];
  const err = (code: string, message: string) => issues.push({ level: "error", code, message });
  const warn = (code: string, message: string) => issues.push({ level: "warning", code, message });

  const ewc = normaliseEwc(t.ewcCode);
  if (!t.ewcCode) err("ewc_missing", "No EWC code. Every transfer must describe the waste with its List of Waste code.");
  else if (!ewc) err("ewc_invalid", `"${t.ewcCode}" is not a List of Waste code (six digits, e.g. 17 01 07).`);
  else if (ewc.endsWith("*") && !t.hazardous) {
    err("ewc_hazardous_mismatch", `EWC ${formatEwc(ewc)} is an absolute hazardous entry, but the record is not marked hazardous.`);
  }

  let tier: DutyOfCareResult["carrier"]["tier"] = null;
  let onFile = false;
  if (!t.carrierName) err("carrier_missing", "No carrier named.");
  if (!t.carrierRegistration) {
    err("registration_missing", "No carrier registration number. You must check the carrier is registered before handing waste over.");
  } else {
    tier = carrierTier(t.carrierRegistration);
    if (tier === "unknown") {
      warn("registration_format", `"${t.carrierRegistration}" is not a recognised UK carrier registration format (e.g. CBDU123456).`);
    } else if (tier === "lower") {
      warn("registration_lower_tier", "Lower-tier registration: only valid for carriers moving waste they produce themselves, not a waste contractor.");
    }
    const match = carriers.find((c) => normaliseRegistration(c.registration) === normaliseRegistration(t.carrierRegistration!));
    onFile = !!match;
    if (!match) {
      warn("registration_not_on_file", "Carrier registration is not on any supplier profile, so its expiry cannot be checked.");
    } else if (match.expiresAt && match.expiresAt < t.recordedAt) {
      err("registration_expired", `Carrier registration expired on ${match.expiresAt.toISOString().slice(0, 10)}, before this transfer.`);
    }
  }

  if (!t.transferNoteReference) {
    err(
      "note_missing",
      t.hazardous ? "No consignment note reference for this hazardous waste." : "No waste transfer note reference.",
    );
  }
  if (!t.destination) warn("destination_missing", "No receiving site recorded.");

  return {
    issues,
    complete: !issues.some((i) => i.level === "error"),
    keepUntil: addYears(t.recordedAt, t.hazardous ? 3 : 2),
    ewcCode: ewc,
    carrier: { tier, onFile },
  };
}
