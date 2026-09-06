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
//
// Field alias design:
// - Each logical field has a list of known label synonyms (_labelAliases).
//   Adding a new company-specific label is a one-line change in that table.
// - Extraction is two-phase: Phase 1 finds "Label: Value" on a single line;
//   Phase 2 finds a label alone on line N and takes line N+1 as the value
//   (covers table-header formats where OCR separates header from row).
// - Quantity extraction first tries labeled lookup (Qty:, No.:, Units: …),
//   then falls back to the weight/count pattern in the raw text.

enum DocumentType { wasteTicket, deliveryNote, fuelReceipt, waterMeterReading, other }

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
  final String? pickupPostcode;
  final String? deliveryPostcode;

  /// Per-field confidence scores.
  /// Keys match [toMap()] keys.  Values are in [0.0, 1.0]:
  ///   0.95 — exact label + value on the same line
  ///   0.80 — label on its own line, value on the next line (table header)
  ///   0.65 — partial / fuzzy / unlabeled pattern match
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
    this.pickupPostcode,
    this.deliveryPostcode,
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
      if (pickupPostcode != null) 'pickupPostcode': pickupPostcode!,
      if (deliveryPostcode != null) 'deliveryPostcode': deliveryPostcode!,
      'fieldConfidence': fieldConfidence,
    };
  }
}

class OcrExtractor {
  // ── Label alias table ───────────────────────────────────────────────────────
  // All known label synonyms for each logical field, normalised to lowercase.
  // Different companies print the same field under wildly different headings —
  // add new synonyms here and _tryLabeledExtraction picks them up automatically.
  static const Map<String, List<String>> _labelAliases = {
    'material': [
      // Generic material / product
      'material', 'materials',
      'product', 'products', 'product description', 'product type',
      'goods', 'goods description',
      'commodity', 'commodities',
      'item', 'items', 'item description', 'item name',
      'contents', 'content',
      'article', 'articles',
      // Description variants — the most common alternative
      'description', 'desc', 'short description', 'full description',
      'line description', 'job description',
      // Waste-specific
      'waste type', 'waste description', 'waste material', 'waste classification',
      'waste category', 'type of waste', 'nature of waste', 'waste nature',
      'load type', 'load description',
      // Transport / supply chain
      'cargo', 'cargo description',
      'freight', 'freight description',
      'consignment', 'consignment description',
      // Construction / aggregates
      'aggregate type', 'material type', 'stone type',
    ],
    'quantity': [
      // Count / number
      'quantity', 'qty', 'qty.',
      'number', 'no', 'no.', 'nos', 'nos.',
      'number of items', 'no of items', 'no. of items',
      'count', 'load count', 'item count',
      // Mass quantity
      'net qty', 'gross qty', 'net quantity', 'gross quantity',
      'nett qty', 'nett quantity',
      // Unit-named quantities
      'units', 'unit qty', 'unit quantity',
      'pieces', 'pcs', 'pcs.',
      // Container types as field labels
      'bags', 'pallets', 'drums', 'rolls', 'sheets',
      'skips', 'loads', 'cases', 'boxes', 'crates',
      // Amount (when used for count, not currency)
      'amount',
    ],
  };

  // ── Confidence constants ────────────────────────────────────────────────────
  static const double _exactMatch = 0.95;    // label: value on same line
  static const double _nextLineMatch = 0.80; // label header, value on next line
  static const double _fuzzyMatch = 0.65;    // pattern match without label
  static const double _notFound = 0.0;

  // ── Dates — UK formats ──────────────────────────────────────────────────────

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

  // ── EWC codes ───────────────────────────────────────────────────────────────

  static final _ewcLabelled = RegExp(
    r'ewc[^0-9]{0,12}(\d{2})[\s./-]?(\d{2})[\s./-]?(\d{2})\b',
    caseSensitive: false,
  );

  static final _ewcSeparated = RegExp(
    r'\b(\d{2})[\s./-](\d{2})[\s./-](\d{2})\b',
  );

  // ── Vehicle registrations (uppercase — plates print in capitals) ────────────

  static final _regCurrent = RegExp(r'\b[A-Z]{2}\d{2}\s?[A-Z]{3}\b');
  static final _regPrefix = RegExp(r'\b[A-Z]\d{1,3}\s?[A-Z]{3}\b');
  static final _regSuffix = RegExp(r'\b[A-Z]{3}\s?\d{1,3}[A-Z]\b');

  // ── Mass quantities ─────────────────────────────────────────────────────────

  static final _weightPattern = RegExp(
    r'(\d{1,6}(?:[.,]\d{1,3})?)\s*(kilograms?|kgs|kg|tonnes?|tons?|t)\b',
    caseSensitive: false,
  );

  static final _volumePattern = RegExp(
    r'(\d{1,6}(?:[.,]\d{1,3})?)\s*(litres?|liters?|ltrs?|l|gallons?|gal)\b',
    caseSensitive: false,
  );

  // ── Discrete count units ────────────────────────────────────────────────────
  // Matches an unlabeled count in the text: "5 pallets", "12 bags", etc.
  static final _countPattern = RegExp(
    r'(\d{1,6}(?:[.,]\d{1,3})?)\s*'
    r'(pallets?|bags?|drums?|rolls?|sheets?|pieces?|pcs\.?|items?|loads?|'
    r'skips?|cases?|boxes?|crates?|units?)\b',
    caseSensitive: false,
  );

  // ── Fuel keywords, longest-first so "red diesel" wins over "diesel" ─────────

  static const _fuelTypes = [
    'red diesel', 'gas oil', 'diesel', 'unleaded', 'petrol',
    'kerosene', 'adblue', 'hvo', 'lpg',
  ];

  // ── Supplier names ──────────────────────────────────────────────────────────

  static final _supplierLabelled = RegExp(
    r'^(?:supplier|carrier|haulier|company|merchant|vendor|from)'
    r'\s*[:\-]\s*(.+)$',
    caseSensitive: false,
  );

  static final _companySuffix = RegExp(
    r'\b(?:ltd|limited|plc|llp|group|& sons?)\.?$',
    caseSensitive: false,
  );

  // ── UK postcodes — e.g. "SW1A 1AA", "M1 1AE", "B33 8TH" ──────────────────

  static final _postcodePattern = RegExp(
    r'\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b',
    caseSensitive: false,
  );

  // ── Core extraction ─────────────────────────────────────────────────────────

  static ExtractedFields extract(String rawText, DocumentType type) {
    final lines = rawText
        .split(RegExp(r'[\r\n]+'))
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();
    var working = rawText.replaceAll(RegExp(r'[\r\n]+'), ' ');

    // 1. Date first — mask all date-shaped runs so their digits are never
    //    mistaken for EWC codes or vehicle registrations.
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
    final vehicleRegConfidence = vehicleReg != null ? _exactMatch : _notFound;

    // 4. Weight — prefer an explicit "net" line over the first match.
    final weightResult = _extractWeightWithConfidence(working, lines);
    final weightMatch = weightResult.$1;
    final weightConfidence = weightResult.$2;

    // 5. Volume + fuel type.
    final volumeMatch = _volumePattern.firstMatch(working);
    final volumeConfidence = volumeMatch != null ? _exactMatch : _notFound;
    final fuelType = _extractFuelType(working);
    final fuelConfidence = fuelType != null ? _exactMatch : _notFound;

    // 6. Supplier name.
    final supplierResult = _extractSupplierWithConfidence(lines);
    final supplierName = supplierResult.$1;
    final supplierConfidence = supplierResult.$2;

    // 7. UK postcodes.
    final postcode = _extractPostcode(working);
    final postcodeConfidence = postcode != null ? _exactMatch : _notFound;
    final postcodeResult = _extractPickupDeliveryPostcodes(working);
    final pickupPostcode = postcodeResult.$1;
    final deliveryPostcode = postcodeResult.$2;
    final pickupPostcodeConfidence =
        pickupPostcode != null ? _exactMatch : _notFound;
    final deliveryPostcodeConfidence =
        deliveryPostcode != null ? _exactMatch : _notFound;

    // 8. Material / product type — two-phase label lookup with expanded aliases.
    final materialResult = _extractMaterialWithConfidence(lines);
    final materialType = materialResult.$1;
    final materialConfidence = materialResult.$2;

    // 9. Quantity — labeled lookup first, then weight/count pattern fallback.
    //    For delivery notes, the quantity is the mass delivered.
    //    For waste tickets, weight carries mass; quantity is used for count.
    final isDelivery = type == DocumentType.deliveryNote;
    final extractedWeight =
        weightMatch == null ? null : _normalizeNumber(weightMatch.group(1)!);
    final extractedWeightUnit =
        weightMatch == null ? null : _normalizeWeightUnit(weightMatch.group(2)!);

    String? finalQuantity;
    String? finalQuantityUnit;
    double quantityConfidence;

    if (isDelivery) {
      // Delivery notes: try labeled quantity first, fall back to weight pattern.
      final qtyResult = _extractQuantityWithConfidence(lines, working);
      if (qtyResult.$1 != null) {
        finalQuantity = qtyResult.$1;
        finalQuantityUnit = qtyResult.$2;
        quantityConfidence = qtyResult.$3;
      } else {
        // Fall back to weight pattern.
        finalQuantity = extractedWeight;
        finalQuantityUnit = extractedWeightUnit;
        quantityConfidence = weightMatch != null ? weightConfidence : _notFound;
      }
    } else {
      finalQuantity = null;
      finalQuantityUnit = null;
      quantityConfidence = _notFound;
    }

    final confidence = <String, double>{
      'weight': isDelivery ? _notFound : weightConfidence,
      'weightUnit': isDelivery ? _notFound : (weightMatch != null ? _exactMatch : _notFound),
      'ewcCode': ewcConfidence,
      'date': dateConfidence,
      'vehicleReg': vehicleRegConfidence,
      'supplierName': supplierConfidence,
      'fuelType': fuelConfidence,
      'volume': volumeConfidence,
      'volumeUnit': volumeMatch != null ? _exactMatch : _notFound,
      'postcode': postcodeConfidence,
      'pickupPostcode': pickupPostcodeConfidence,
      'deliveryPostcode': deliveryPostcodeConfidence,
      'materialType': materialConfidence,
      'quantity': quantityConfidence,
      'quantityUnit': finalQuantityUnit != null ? quantityConfidence : _notFound,
    };

    return ExtractedFields(
      documentType: type,
      weight: isDelivery ? null : extractedWeight,
      weightUnit: isDelivery ? null : extractedWeightUnit,
      quantity: finalQuantity,
      quantityUnit: finalQuantityUnit,
      ewcCode: ewcCode,
      date: date,
      vehicleReg: vehicleReg,
      supplierName: supplierName,
      materialType: materialType,
      fuelType: fuelType,
      volume: volumeMatch == null
          ? null
          : _normalizeNumber(volumeMatch.group(1)!),
      volumeUnit: volumeMatch == null
          ? null
          : _normalizeVolumeUnit(volumeMatch.group(2)!),
      postcode: postcode,
      pickupPostcode: pickupPostcode,
      deliveryPostcode: deliveryPostcode,
      fieldConfidence: confidence,
    );
  }

  // ── Two-phase label-value lookup ────────────────────────────────────────────

  /// Searches [lines] for any alias in [aliases] using two strategies:
  ///
  /// Phase 1 — inline:  "Label[: -] Value" on a single line.
  ///   Returns (value, 0.95).
  ///
  /// Phase 2 — table header:  alias alone on line N, next non-empty line is
  ///   the value.  Returns (value, 0.80).  Handles ticket formats like:
  ///     DESCRIPTION
  ///     Mixed demolition waste
  ///   or column headers where OCR places the header on its own line.
  ///
  /// Returns (null, 0.0) when no alias matches.
  static (String?, double) _tryLabeledExtraction(
      List<String> lines, List<String> aliases,
      {int maxValueLen = 100}) {
    // Build a single alternation from all aliases — longest first so more
    // specific labels (e.g. "product description") beat shorter ones ("product").
    final sorted = [...aliases]
      ..sort((a, b) => b.length.compareTo(a.length));
    final alternation = sorted.map(RegExp.escape).join('|');

    // Phase 1: "Label: Value" or "Label - Value" on one line.
    final inlineRe = RegExp(
      r'^(?:' + alternation + r')\s*[:\-]\s*(.+)$',
      caseSensitive: false,
    );
    for (final line in lines) {
      final m = inlineRe.firstMatch(line);
      if (m != null) {
        final v = m.group(1)!.trim();
        if (v.isNotEmpty && v.length <= maxValueLen) {
          return (v, _exactMatch);
        }
      }
    }

    // Phase 2: alias as a standalone line (table header), value on next line.
    // The alias may optionally end with ":" with no value after it.
    final headerRe = RegExp(
      r'^(?:' + alternation + r')\s*:?\s*$',
      caseSensitive: false,
    );
    for (int i = 0; i < lines.length - 1; i++) {
      if (headerRe.hasMatch(lines[i])) {
        for (int j = i + 1; j < lines.length; j++) {
          final next = lines[j].trim();
          if (next.isNotEmpty && next.length <= maxValueLen) {
            return (next, _nextLineMatch);
          }
        }
      }
    }

    return (null, _notFound);
  }

  // ── Material / product type ─────────────────────────────────────────────────

  static (String?, double) _extractMaterialWithConfidence(List<String> lines) {
    return _tryLabeledExtraction(
      lines,
      _labelAliases['material']!,
      maxValueLen: 120,
    );
  }

  // ── Quantity extraction ─────────────────────────────────────────────────────

  /// Returns (value, unit | null, confidence).
  /// Priority: labeled lookup → weight pattern → count pattern.
  static (String?, String?, double) _extractQuantityWithConfidence(
      List<String> lines, String working) {
    // 1. Labeled lookup — handles "Qty: 5 pallets", "No.: 12", "Units: 2.5 t".
    final labeled = _tryLabeledExtraction(lines, _labelAliases['quantity']!);
    if (labeled.$1 != null) {
      // The value may contain a number+unit ("2.5 tonnes") or just a number.
      final raw = labeled.$1!;
      final wm = _weightPattern.firstMatch(raw);
      if (wm != null) {
        return (
          _normalizeNumber(wm.group(1)!),
          _normalizeWeightUnit(wm.group(2)!),
          labeled.$2,
        );
      }
      final cm = _countPattern.firstMatch(raw);
      if (cm != null) {
        return (
          _normalizeNumber(cm.group(1)!),
          cm.group(2)!.toLowerCase(),
          labeled.$2,
        );
      }
      // Bare number (e.g. "Qty: 5") — return without unit.
      final numOnly = RegExp(r'^\d{1,6}(?:[.,]\d{1,3})?$').firstMatch(raw.trim());
      if (numOnly != null) {
        return (_normalizeNumber(numOnly.group(0)!), null, labeled.$2);
      }
      // Arbitrary text value — return as-is (e.g. "Qty: 5 bags of rubble").
      return (raw, null, labeled.$2);
    }

    // 2. Count pattern (unlabeled): "5 pallets", "12 bags".
    final cm = _countPattern.firstMatch(working);
    if (cm != null) {
      return (
        _normalizeNumber(cm.group(1)!),
        cm.group(2)!.toLowerCase(),
        _fuzzyMatch,
      );
    }

    return (null, null, _notFound);
  }

  // ── Postcode helpers ────────────────────────────────────────────────────────

  static String? _extractPostcode(String text) {
    final m = _postcodePattern.firstMatch(text);
    if (m == null) return null;
    return '${m.group(1)!.toUpperCase()} ${m.group(2)!.toUpperCase()}';
  }

  static (String?, String?) _extractPickupDeliveryPostcodes(String text) {
    final matches = _postcodePattern.allMatches(text).toList();
    if (matches.isEmpty) return (null, null);
    String normalize(RegExpMatch m) =>
        '${m.group(1)!.toUpperCase()} ${m.group(2)!.toUpperCase()}';
    if (matches.length == 1) return (normalize(matches[0]), null);
    return (normalize(matches[0]), normalize(matches[1]));
  }

  // ── Date helpers ────────────────────────────────────────────────────────────

  static (String?, double) _extractDateWithConfidence(String text) {
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

  // ── EWC helpers ─────────────────────────────────────────────────────────────

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
          _fuzzyMatch,
        );
      }
    }
    return (null, _notFound);
  }

  // ── Weight helpers ──────────────────────────────────────────────────────────

  static (RegExpMatch?, double) _extractWeightWithConfidence(
      String working, List<String> lines) {
    for (final line in lines) {
      if (line.toLowerCase().contains('net')) {
        final m = _weightPattern.firstMatch(line);
        if (m != null) return (m, _exactMatch);
      }
    }
    final m = _weightPattern.firstMatch(working);
    return (m, m != null ? _fuzzyMatch : _notFound);
  }

  // ── Supplier helpers ────────────────────────────────────────────────────────

  static (String?, double) _extractSupplierWithConfidence(List<String> lines) {
    for (final line in lines) {
      final m = _supplierLabelled.firstMatch(line);
      if (m != null) {
        final v = m.group(1)!.trim();
        if (v.isNotEmpty) return (v, _exactMatch);
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

  // ── Shared helpers ──────────────────────────────────────────────────────────

  static bool _validEwcChapter(String chapter) {
    final n = int.tryParse(chapter);
    return n != null && n >= 1 && n <= 20;
  }

  static String? _extractVehicleReg(String text) {
    for (final pattern in [_regCurrent, _regPrefix, _regSuffix]) {
      final m = pattern.firstMatch(text);
      if (m != null) return m.group(0)!.replaceAll(RegExp(r'\s+'), '');
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

  /// "1,250" (thousands) → "1250"; "2,5" (continental decimal) → "2.5".
  static String _normalizeNumber(String raw) {
    if (RegExp(r'^\d{1,3},\d{3}$').hasMatch(raw)) return raw.replaceAll(',', '');
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

  /// Replace every match with spaces of equal length, preserving character indices.
  static String _maskAll(String text, RegExp pattern) {
    return text.replaceAllMapped(pattern, (m) => ' ' * (m.end - m.start));
  }
}
