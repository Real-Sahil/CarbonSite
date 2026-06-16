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

  /// Per-field confidence scores.
  /// Keys match [toMap()] keys.  Values are in [0.0, 1.0]:
  ///   0.95 — exact pattern match
  ///   0.65 — partial / fuzzy match
  ///   0.0  — not found (field is null)
  final Map<String, double> fieldConfidence;

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
    this.fieldConfidence = const {},
  });

  /// Non-null extracted values keyed by field name — handy for pre-filling
  /// the review form and for marking which fields were auto-extracted.
  Map<String, dynamic> toMap() {
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
      'fieldConfidence': fieldConfidence,
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

  // ---------------------------------------------------------------------
  // UK postcodes — e.g. "SW1A 1AA", "M1 1AE", "B33 8TH", "CR2 6XH"
  // ---------------------------------------------------------------------

  static final _postcodePattern = RegExp(
    r'\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b',
    caseSensitive: false,
  );

  // ---------------------------------------------------------------------
  // Material / product type (delivery notes)
  // ---------------------------------------------------------------------

  static final _materialLabelled = RegExp(
    r'^(?:material|materials|description|product|goods|commodity|item|'
    r'waste\s*type|waste\s*description)\s*[:\-]\s*(.+)$',
    caseSensitive: false,
  );

  // Confidence score constants.
  static const double _exactMatch = 0.95;
  static const double _fuzzyMatch = 0.65;
  static const double _notFound = 0.0;

  static ExtractedFields extract(String rawText, DocumentType type) {
    final lines = rawText
        .split(RegExp(r'[\r\n]+'))
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();
    var working = rawText.replaceAll(RegExp(r'[\r\n]+'), ' ');

    // 1. Date first, then mask all date-shaped runs so their digits cannot
    //    be misread as EWC codes or registrations.
    final dateResult = _extractDateWithConfidence(working);
    final date = dateResult.$1;
    final dateConfidence = dateResult.$2;
    working = _maskAll(working, _numericDate);
    working = _maskAll(working, _isoDate);
    working = _maskAll(working, _writtenDate);

    // 2. EWC code (chapter-validated).
    final ewcResult = _extractEwcWithConfidence(working);
    final ewcCode = ewcResult.$1;
    final ewcConfidence = ewcResult.$2;

    // 3. Vehicle registration.
    final vehicleReg = _extractVehicleReg(working);
    final vehicleRegConfidence =
        vehicleReg != null ? _exactMatch : _notFound;

    // 4. Weight — prefer an explicit "net" line over the first match.
    final weightResult = _extractWeightWithConfidence(working, lines);
    final weightMatch = weightResult.$1;
    final weightConfidence = weightResult.$2;

    // 5. Volume + fuel type (fuel receipts, but harmless elsewhere).
    final volumeMatch = _volumePattern.firstMatch(working);
    final volumeConfidence = volumeMatch != null ? _exactMatch : _notFound;

    final fuelType = _extractFuelType(working);
    final fuelConfidence = fuelType != null ? _exactMatch : _notFound;

    // 6. Supplier name from line heuristics.
    final supplierResult = _extractSupplierWithConfidence(lines);
    final supplierName = supplierResult.$1;
    final supplierConfidence = supplierResult.$2;

    // 7. UK postcode (pickup/delivery site — feeds transport distance calc).
    final postcode = _extractPostcode(working);
    final postcodeConfidence = postcode != null ? _exactMatch : _notFound;

    // 8. Material / product type (delivery notes).
    final materialResult = _extractMaterialWithConfidence(lines);
    final materialType = materialResult.$1;
    final materialConfidence = materialResult.$2;

    final confidence = <String, double>{
      'weight': weightConfidence,
      'weightUnit': weightMatch != null ? _exactMatch : _notFound,
      'ewcCode': ewcConfidence,
      'date': dateConfidence,
      'vehicleReg': vehicleRegConfidence,
      'supplierName': supplierConfidence,
      'fuelType': fuelConfidence,
      'volume': volumeConfidence,
      'volumeUnit': volumeMatch != null ? _exactMatch : _notFound,
      'postcode': postcodeConfidence,
      'materialType': materialConfidence,
    };

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
      materialType: materialType,
      fuelType: fuelType,
      volume:
          volumeMatch == null ? null : _normalizeNumber(volumeMatch.group(1)!),
      volumeUnit: volumeMatch == null
          ? null
          : _normalizeVolumeUnit(volumeMatch.group(2)!),
      postcode: postcode,
      fieldConfidence: confidence,
    );
  }

  /// First UK postcode in the text, normalised to "OUTWARD INWARD" upper case.
  static String? _extractPostcode(String text) {
    final m = _postcodePattern.firstMatch(text);
    if (m == null) return null;
    return '${m.group(1)!.toUpperCase()} ${m.group(2)!.toUpperCase()}';
  }

  /// Returns (material | null, confidence) from a labelled line.
  static (String?, double) _extractMaterialWithConfidence(List<String> lines) {
    for (final line in lines) {
      final m = _materialLabelled.firstMatch(line);
      if (m != null) {
        final value = m.group(1)!.trim();
        if (value.isNotEmpty && value.length <= 80) {
          return (value, _exactMatch);
        }
      }
    }
    return (null, _notFound);
  }

  // -------------------------------------------------------------------------
  // Helpers — with-confidence variants
  // -------------------------------------------------------------------------

  /// Returns (date string | null, confidence).
  static (String?, double) _extractDateWithConfidence(String text) {
    // Numeric / ISO formats are considered exact matches; written dates are
    // slightly more prone to OCR error but still good.
    RegExpMatch? best;
    bool isWritten = false;
    for (final entry in [
      (_numericDate, false),
      (_isoDate, false),
      (_writtenDate, true),
    ]) {
      final m = entry.$1.firstMatch(text);
      if (m != null && (best == null || m.start < best.start)) {
        best = m;
        isWritten = entry.$2;
      }
    }
    if (best == null) return (null, _notFound);
    return (best.group(0), isWritten ? _fuzzyMatch : _exactMatch);
  }

  /// Returns (ewc string | null, confidence).
  static (String?, double) _extractEwcWithConfidence(String text) {
    final labelled = _ewcLabelled.firstMatch(text);
    if (labelled != null && _validEwcChapter(labelled.group(1)!)) {
      return (
        '${labelled.group(1)} ${labelled.group(2)} ${labelled.group(3)}',
        _exactMatch,
      );
    }
    for (final m in _ewcSeparated.allMatches(text)) {
      if (_validEwcChapter(m.group(1)!)) {
        return (
          '${m.group(1)} ${m.group(2)} ${m.group(3)}',
          _fuzzyMatch, // no explicit label — higher chance of false positive
        );
      }
    }
    return (null, _notFound);
  }

  /// Returns (RegExpMatch? | null, confidence).
  static (RegExpMatch?, double) _extractWeightWithConfidence(
      String working, List<String> lines) {
    for (final line in lines) {
      if (line.toLowerCase().contains('net')) {
        final m = _weightPattern.firstMatch(line);
        if (m != null) return (m, _exactMatch); // explicit "net" line
      }
    }
    final m = _weightPattern.firstMatch(working);
    // First match in document without "net" label — slightly less certain.
    return (m, m != null ? _fuzzyMatch : _notFound);
  }

  /// Returns (supplier | null, confidence).
  static (String?, double) _extractSupplierWithConfidence(List<String> lines) {
    for (final line in lines) {
      final m = _supplierLabelled.firstMatch(line);
      if (m != null) {
        final value = m.group(1)!.trim();
        if (value.isNotEmpty) return (value, _exactMatch);
      }
    }
    for (final line in lines) {
      if (line.length <= 48 && _companySuffix.hasMatch(line)) {
        return (
          line.replaceAll(RegExp(r'[.,;]+$'), '').trim(),
          _fuzzyMatch,
        );
      }
    }
    return (null, _notFound);
  }

  // -------------------------------------------------------------------------
  // Shared helpers
  // -------------------------------------------------------------------------

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

  static String? _extractFuelType(String text) {
    final lower = text.toLowerCase();
    for (final fuel in _fuelTypes) {
      if (lower.contains(fuel)) return fuel;
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
