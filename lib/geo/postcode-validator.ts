// Server-side UK postcode validation and OCR error correction.
//
// Uses the `postcode` npm package (ideal-postcodes/postcode) for:
//   - Format validation against the full Royal Mail postcode regex
//   - OCR common-substitution correction: O↔0, I↔1, S↔5 etc. via fix()
//   - Extraction of all postcode candidates from raw text
//
// Uses label-context heuristics to identify which postcode on a delivery
// ticket is the delivery/receipt location vs the sender/origin location.

import { isValid, toNormalised, fix, match } from "postcode";

export type PostcodeValidationStatus =
  | "valid"         // exact match, no correction needed
  | "corrected"     // OCR error fixed, now valid
  | "invalid"       // could not produce a valid postcode
  | "needs_review"; // ambiguous — human should confirm

export type PostcodeExtractionSource =
  | "label_identified"   // found via delivery/destination/to label on the ticket
  | "position_heuristic" // second-postcode-found heuristic
  | "manual"             // manually entered by field worker
  | "only_found";        // only one postcode found on the ticket

export interface ValidatedPostcode {
  original: string;
  corrected: string | null;
  normalised: string | null;
  status: PostcodeValidationStatus;
}

export interface DeliveryPostcodeResult {
  deliveryPostcode: string | null;
  deliveryPostcodeOriginal: string | null;
  pickupPostcode: string | null;
  postcodeValidationStatus: PostcodeValidationStatus;
  postcodeExtractionSource: PostcodeExtractionSource;
  allCandidates: string[];
}

// Labels that indicate the postcode following them is the delivery/receipt location.
const DELIVERY_LABELS = [
  "delivery postcode",
  "delivery address",
  "delivery site",
  "delivery location",
  "delivery:",
  "delivered to",
  "deliver to",
  "destination postcode",
  "destination:",
  "destination address",
  "site postcode",
  "site address",
  "site:",
  "unloading point",
  "consignee postcode",
  "consignee:",
  "receiving site",
  "to postcode",
  "to:",
  "ship to",
  "bill to",
];

// Labels that indicate the postcode following them is the origin/pickup location.
const PICKUP_LABELS = [
  "collection postcode",
  "collection address",
  "collection:",
  "collected from",
  "collect from",
  "origin postcode",
  "origin:",
  "from postcode",
  "from:",
  "from address",
  "pickup:",
  "pick-up:",
  "loading point",
  "consignor postcode",
  "consignor:",
  "sender:",
  "supplier postcode",
  "dispatched from",
  "dispatch address",
];

/**
 * Validate and attempt OCR correction of a single postcode string.
 * Returns the original, any corrected form, the normalised form, and a status.
 */
export function validatePostcode(raw: string): ValidatedPostcode {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) {
    return { original: raw, corrected: null, normalised: null, status: "invalid" };
  }

  // Direct validation
  const normalised = toNormalised(trimmed);
  if (normalised && isValid(trimmed)) {
    return { original: raw, corrected: null, normalised, status: "valid" };
  }

  // Attempt OCR error correction via fix()
  const fixed = fix(trimmed);
  if (fixed) {
    const fixedNormalised = toNormalised(fixed);
    if (fixedNormalised && isValid(fixed)) {
      return { original: raw, corrected: fixed, normalised: fixedNormalised, status: "corrected" };
    }
  }

  return { original: raw, corrected: null, normalised: null, status: "invalid" };
}

/**
 * Extract all valid postcode candidates from raw OCR text.
 * Returns normalised postcodes in order of appearance.
 */
export function extractPostcodesFromText(rawText: string): string[] {
  const candidates = match(rawText) ?? [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const candidate of candidates) {
    const normalised = toNormalised(candidate);
    if (normalised && !seen.has(normalised)) {
      seen.add(normalised);
      result.push(normalised);
    }
  }
  return result;
}

/**
 * Identify the delivery/receipt postcode from raw OCR text.
 *
 * Strategy (in priority order):
 * 1. Scan each line: if a delivery label appears immediately before a postcode,
 *    that postcode is the delivery location.
 * 2. If no label match: two postcodes → first = pickup, second = delivery.
 * 3. If only one postcode: mark it as delivery (delivery note context).
 * 4. If no postcodes: return nulls with NEEDS_REVIEW status.
 */
export function identifyDeliveryPostcode(
  rawOcrText: string | null | undefined,
  ocrExtractedFields: {
    pickupPostcode?: string | null;
    deliveryPostcode?: string | null;
    postcode?: string | null;
  } | null | undefined,
): DeliveryPostcodeResult {
  // Step 1: extract all valid postcode candidates from the raw OCR text.
  const fromText = rawOcrText ? extractPostcodesFromText(rawOcrText) : [];

  // Fall back to what the mobile OCR already extracted if raw text unavailable.
  const fallbackDelivery = ocrExtractedFields?.deliveryPostcode;
  const fallbackPickup = ocrExtractedFields?.pickupPostcode;
  const fallbackAny = ocrExtractedFields?.postcode;

  const allCandidates = fromText.length > 0 ? fromText : [
    ...(fallbackPickup ? [fallbackPickup] : []),
    ...(fallbackDelivery ? [fallbackDelivery] : []),
    ...(!fallbackPickup && !fallbackDelivery && fallbackAny ? [fallbackAny] : []),
  ];

  if (allCandidates.length === 0) {
    return {
      deliveryPostcode: null,
      deliveryPostcodeOriginal: null,
      pickupPostcode: null,
      postcodeValidationStatus: "needs_review",
      postcodeExtractionSource: "label_identified",
      allCandidates: [],
    };
  }

  // Step 2: label-context scan on raw OCR text if available.
  if (rawOcrText) {
    const lower = rawOcrText.toLowerCase();
    const lines = rawOcrText.split(/[\r\n]+/);

    // For each line, check if it contains a delivery label followed by a postcode.
    let labelDelivery: string | null = null;
    let labelPickup: string | null = null;

    for (const line of lines) {
      const lineLower = line.toLowerCase();
      const linePostcodes = extractPostcodesFromText(line);
      if (linePostcodes.length === 0) continue;

      const isDeliveryLine = DELIVERY_LABELS.some((label) => lineLower.includes(label));
      const isPickupLine = PICKUP_LABELS.some((label) => lineLower.includes(label));

      if (isDeliveryLine && !labelDelivery) {
        labelDelivery = linePostcodes[0];
      } else if (isPickupLine && !labelPickup) {
        labelPickup = linePostcodes[0];
      }
    }

    // Also scan for label on the line immediately ABOVE a postcode-only line.
    for (let i = 1; i < lines.length; i++) {
      const prevLineLower = lines[i - 1].toLowerCase();
      const currentLinePostcodes = extractPostcodesFromText(lines[i]);
      if (currentLinePostcodes.length === 0) continue;

      const isDeliveryContext = DELIVERY_LABELS.some((label) => prevLineLower.includes(label));
      const isPickupContext = PICKUP_LABELS.some((label) => prevLineLower.includes(label));

      if (isDeliveryContext && !labelDelivery) {
        labelDelivery = currentLinePostcodes[0];
      } else if (isPickupContext && !labelPickup) {
        labelPickup = currentLinePostcodes[0];
      }
    }

    if (labelDelivery) {
      const validated = validatePostcode(labelDelivery);
      return {
        deliveryPostcode: validated.normalised,
        deliveryPostcodeOriginal: labelDelivery,
        pickupPostcode: labelPickup ?? (allCandidates.find((p) => p !== labelDelivery) ?? null),
        postcodeValidationStatus: validated.status,
        postcodeExtractionSource: "label_identified",
        allCandidates,
      };
    }
  }

  // Step 3: position heuristic — last postcode = delivery, first = pickup.
  // Delivery tickets typically print the destination after the origin.
  if (allCandidates.length === 1) {
    const validated = validatePostcode(allCandidates[0]);
    return {
      deliveryPostcode: validated.normalised,
      deliveryPostcodeOriginal: allCandidates[0],
      pickupPostcode: null,
      postcodeValidationStatus: validated.status,
      postcodeExtractionSource: "only_found",
      allCandidates,
    };
  }

  // Two or more postcodes: first = pickup (sender), last = delivery (recipient).
  const pickup = allCandidates[0];
  const delivery = allCandidates[allCandidates.length - 1];
  const validated = validatePostcode(delivery);

  return {
    deliveryPostcode: validated.normalised,
    deliveryPostcodeOriginal: delivery,
    pickupPostcode: pickup,
    postcodeValidationStatus: validated.status,
    postcodeExtractionSource: "position_heuristic",
    allCandidates,
  };
}
