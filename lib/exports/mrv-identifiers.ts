// Kept apart from the workbook builder so the page can use it without bundling the spreadsheet library.

/** Identifiers still missing, so the page can say what to add before the export is useful. */
export function missingIdentifiers(f: { economicLicenceNumber: string | null; environmentalPermitNumber: string | null; address: string | null; latitude: number | null; longitude: number | null }): string[] {
  const out: string[] = [];
  if (!f.economicLicenceNumber) out.push("Economic licence number");
  if (!f.environmentalPermitNumber) out.push("Environmental permit number");
  if (!f.address) out.push("Facility address");
  if (f.latitude == null || f.longitude == null) out.push("Coordinates of the main entrance");
  return out;
}

