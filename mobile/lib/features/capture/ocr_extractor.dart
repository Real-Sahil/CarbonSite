// OCR text extraction logic — deterministic, testable independently of the
// camera and ML Kit.
//
// Input: raw text from google_mlkit_text_recognition
// Output: structured fields for each document type
//
// Design notes:
// - Extraction order matters: dates are found first and masked out of the
//   working text so date digits are never mistaken for EWC codes or
//   vehicle registrations.
// - EWC codes must have a valid chapter (01-20). A contiguous 6-digit run
//   is only accepted when it follows an explicit "EWC" label; otherwise the
//   separated "XX XX XX" form is required.
// - Vehicle registrations are matched uppercase-only (plates are printed in
//   capitals) across the three UK eras: current (AB12 CDE), prefix
//   (P123 XYZ, 1983-2001) and suffix (ABC 123D, 1963-1982).
// - No randomness, no locale dependence: same input always yields the same
//   output, so the whole module is unit-testable with static fixtures.

enum DocumentType { wasteTicket, deliveryNote, fuelReceipt, other }

class ExtractedFields {
  final DocumentType documentType;
  final String? weight;
  final String? weightUnit;
  final String? ewcCode;
  final String? date;
  final String? vehicleReg;
  final String? supplierName;
  final String? materialType;
  final String? quantity;
  final String? quantityUnit;
  final String? fuelType;
  final String? volume;
  final String? volumeUnit;
  final String? postcode;

  const ExtractedFields({
    required this.documentType,
    this.weight,
    this.weightUnit,
    this.ewcCode,
    this.date,
    this.vehicleReg,
    this.supplierName,
    this.materialType,
    this.quantity,
    this.quantityUnit,
    this.fuelType,
    this.volume,
    this.volumeUnit,
    this.postcode,
  });

  /// Non-null extracted values keyed by field name — handy for pre-filling
  /// the review form and for marking which fields were auto-extracted.
  Map<String, String> toMap() {
    return {
      if (weight != null) 'weight': weight!,
      if (weightUnit != null) 'weightUnit': weightUnit!,
      if (ewcCode != null) 'ewcCode': ewcCode!,
      if (date != null) 'date': date!,
      if (vehicleReg != null) 'vehicleReg': vehicleReg!,
      if (supplierName != null) 'supplierName': supplierName!,
      if (materialType != null) 'materialType': materialType!,
      if (quantity != null) 'quantity': quantity!,
      if (quantityUnit != null) 'quantityUnit': quantityUnit!,
      if (fuelType != null) 'fuelType': fuelType!,
      if (volume != null) 'volume': volume!,
      if (volumeUnit != null) 'volumeUnit': volumeUnit!,
      if (postcode != null) 'postcode': postcode!,
    };
  }
}

class OcrExtractor {
  // ---------------------------------------------------------------------
  // Dates — UK formats
  // ---------------------------------------------------------------------

  /// dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy (2- or 4-digit year)
  static final _numericDate = RegExp(
    r'\b\d{1,2}[/\-.]\d{1,2}[/\-.](?:\d{4}|\d{2})\b',
  );

  /// ISO yyyy-mm-dd (common on printed tickets)
  static final _isoDate = RegExp(r'\b\d{4}-\d{2}-\d{2}\b');

  /// dd MMM yyyy / dd Month yyyy, with optional ordinal: "3rd March 2026"
  static final _writtenDate = RegExp(
    r'\b\d{1,2}(?:st|nd|rd|th)?\s+'
    r'(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+'
    r'\d{4}\b',
    caseSensitive: false,
  );

  // ---------------------------------------------------------------------
  // EWC codes
  // ---------------------------------------------------------------------

  /// "EWC" label followed (within a few chars) by a 6-digit code in any
  /// separated or contiguous form.
  static final _ewcLabelled = RegExp(
    r'ewc[^0-9]{0,12}(\d{2})[\s./-]?(\d{2})[\s./-]?(\d{2})\b',
    caseSensitive: false,
  );

  /// Unlabelled codes must use explicit separators: "17 09 04", "17.09.04"
  static final _ewcSeparated = RegExp(
    r'\b(\d{2})[\s./-](\d{2})[\s./-](\d{2})\b',
  );

  // ---------------------------------------------------------------------
  // Vehicle registrations (uppercase only — plates print in capitals)
  // ---------------------------------------------------------------------

  static final _regCurrent = RegExp(r'\b[A-Z]{2}\d{2}\s?[A-Z]{3}\b');
  static final _regPrefix = RegExp(r'\b[A-Z]\d{1,3}\s?[A-Z]{3}\b');
  static final _regSuffix = RegExp(r'\b[A-Z]{3}\s?\d{1,3}[A-Z]\b');

  // ---------------------------------------------------------------------
  // Quantities
  // ---------------------------------------------------------------------

  static final _weightPattern = RegExp(
    r'(\d{1,6}(?:[.,]\d{1,3})?)\s*(kilograms?|kgs|kg|tonnes?|tons?|t)\b',
    caseSensitive: false,
  );

  static final _volumePattern = RegExp(
    r'(\d{1,6}(?:[.,]\d{1,3})?)\s*(litres?|liters?|ltrs?|l|gallons?|gal)\b',
    caseSensitive: false,
  );

  /// Fuel keywords, longest-first so "red diesel" wins over "diesel".
  static const _fuelTypes = [
    'red diesel',
    'gas oil',
    'diesel',
    'unleaded',
    'petrol',
    'kerosene',
    'adblue',
    'hvo',
    'lpg',
  ];

  // ---------------------------------------------------------------------
  // UK postcodes — used to pre-fill pickup/delivery postcode for transport
  // carbon calculations.
  // Matches both spaced (SW1A 1AA) and unspaced (SW1A1AA) forms.
  // ---------------------------------------------------------------------

  static final _ukPostcode = RegExp(
    r'\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b',
    caseSensitive: false,
  );

  static String? _extractPostcode(String text) {
    final m = _ukPostcode.firstMatch(text);
    if (m == null) return null;
    final raw = m.group(1)!.toUpperCase().replaceAll(RegExp(r'\s+'), '');
    // Normalise to outward + inward with a single space (SW1A 1AA).
    if (raw.length >= 5) {
      return '${raw.substring(0, raw.length - 3)} ${raw.substring(raw.length - 3)}';
    }
    return raw;
  }

  // ---------------------------------------------------------------------
  // Supplier names
  // ---------------------------------------------------------------------

  static final _supplierLabelled = RegExp(
    r'^(?:supplier|carrier|haulier|company|merchant|vendor|from)'
    r'\s*[:\-]\s*(.+)$',
    caseSensitive: false,
  );

  static final _companySuffix = RegExp(
    r'\b(?:ltd|limited|plc|llp|group|& sons?)\.?$',
    caseSensitive: false,
  );

  static ExtractedFields extract(String rawText, DocumentType type) {
    final lines = rawText
        .split(RegExp(r'[\r\n]+'))
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();
    var working = rawText.replaceAll(RegExp(r'[\r\n]+'), ' ');

    // 1. Date first, then mask all date-shaped runs so their digits cannot
    //    be misread as EWC codes or registrations.
    final date = _extractDate(working);
    working = _maskAll(working, _numericDate);
    working = _maskAll(working, _isoDate);
    working = _maskAll(working, _writtenDate);

    // 2. EWC code (chapter-validated).
    final ewcCode = _extractEwc(working);

    // 3. Vehicle registration.
    final vehicleReg = _extractVehicleReg(working);

    // 4. Weight — prefer an explicit "net" line over the first match.
    final weightMatch = _extractWeight(working, lines);

    // 5. Volume + fuel type (fuel receipts, but harmless elsewhere).
    final volumeMatch = _volumePattern.firstMatch(working);
    final fuelType = _extractFuelType(working);

    // 6. Supplier name from line heuristics.
    final supplierName = _extractSupplier(lines);

    // 7. UK postcode — used for transport carbon distance calculations.
    final postcode = _extractPostcode(rawText);

    // For delivery notes, weight pattern results are quantities, not waste weights.
    final isDelivery = type == DocumentType.deliveryNote;
    final extractedWeight = weightMatch == null ? null : _normalizeNumber(weightMatch.group(1)!);
    final extractedWeightUnit = weightMatch == null ? null : _normalizeWeightUnit(weightMatch.group(2)!);

    return ExtractedFields(
      documentType: type,
      weight: isDelivery ? null : extractedWeight,
      weightUnit: isDelivery ? null : extractedWeightUnit,
      quantity: isDelivery ? extractedWeight : null,
      quantityUnit: isDelivery ? extractedWeightUnit : null,
      ewcCode: ewcCode,
      date: date,
      vehicleReg: vehicleReg,
      supplierName: supplierName,
      fuelType: fuelType,
      volume:
          volumeMatch == null ? null : _normalizeNumber(volumeMatch.group(1)!),
      volumeUnit: volumeMatch == null
          ? null
          : _normalizeVolumeUnit(volumeMatch.group(2)!),
      postcode: postcode,
    );
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /// Earliest date match across all supported formats, returned verbatim.
  static String? _extractDate(String text) {
    RegExpMatch? best;
    for (final pattern in [_numericDate, _isoDate, _writtenDate]) {
      final m = pattern.firstMatch(text);
      if (m != null && (best == null || m.start < best.start)) {
        best = m;
      }
    }
    return best?.group(0);
  }

  static String? _extractEwc(String text) {
    final labelled = _ewcLabelled.firstMatch(text);
    if (labelled != null && _validEwcChapter(labelled.group(1)!)) {
      return '${labelled.group(1)} ${labelled.group(2)} ${labelled.group(3)}';
    }
    for (final m in _ewcSeparated.allMatches(text)) {
      if (_validEwcChapter(m.group(1)!)) {
        return '${m.group(1)} ${m.group(2)} ${m.group(3)}';
      }
    }
    return null;
  }

  /// EWC chapters run 01-20 (European Waste Catalogue).
  static bool _validEwcChapter(String chapter) {
    final n = int.tryParse(chapter);
    return n != null && n >= 1 && n <= 20;
  }

  static String? _extractVehicleReg(String text) {
    for (final pattern in [_regCurrent, _regPrefix, _regSuffix]) {
      final m = pattern.firstMatch(text);
      if (m != null) {
        return m.group(0)!.replaceAll(RegExp(r'\s+'), '');
      }
    }
    return null;
  }

  /// Prefer a weight that appears on a line mentioning "net" (waste tickets
  /// list gross / tare / net — net is the billable figure); otherwise take
  /// the first weight in the document.
  static RegExpMatch? _extractWeight(String working, List<String> lines) {
    for (final line in lines) {
      if (line.toLowerCase().contains('net')) {
        final m = _weightPattern.firstMatch(line);
        if (m != null) return m;
      }
    }
    return _weightPattern.firstMatch(working);
  }

  static String? _extractFuelType(String text) {
    final lower = text.toLowerCase();
    for (final fuel in _fuelTypes) {
      if (lower.contains(fuel)) return fuel;
    }
    return null;
  }

  static String? _extractSupplier(List<String> lines) {
    for (final line in lines) {
      final m = _supplierLabelled.firstMatch(line);
      if (m != null) {
        final value = m.group(1)!.trim();
        if (value.isNotEmpty) return value;
      }
    }
    for (final line in lines) {
      if (line.length <= 48 && _companySuffix.hasMatch(line)) {
        return line.replaceAll(RegExp(r'[.,;]+$'), '').trim();
      }
    }
    return null;
  }

  /// "1,250" (thousands) -> "1250"; "2,5" (continental decimal) -> "2.5".
  static String _normalizeNumber(String raw) {
    if (RegExp(r'^\d{1,3},\d{3}$').hasMatch(raw)) {
      return raw.replaceAll(',', '');
    }
    return raw.replaceAll(',', '.');
  }

  static String _normalizeWeightUnit(String raw) {
    final unit = raw.toLowerCase();
    if (unit.startsWith('k')) return 'kg';
    return 'tonnes';
  }

  static String _normalizeVolumeUnit(String raw) {
    final unit = raw.toLowerCase();
    if (unit.startsWith('gal')) return 'gallons';
    return 'litres';
  }

  /// Replace every match with spaces of equal length, preserving indices.
  static String _maskAll(String text, RegExp pattern) {
    return text.replaceAllMapped(pattern, (m) => ' ' * (m.end - m.start));
  }
}
