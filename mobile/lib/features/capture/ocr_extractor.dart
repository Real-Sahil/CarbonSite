// OCR text extraction logic — deterministic, testable independently of the camera.
// Input: raw text from google_mlkit_text_recognition
// Output: structured fields for each document type

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
  final String? ticketReference;
  final String? pickupPostcode;
  final String? deliveryPostcode;
  final double confidence;

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
    this.ticketReference,
    this.pickupPostcode,
    this.deliveryPostcode,
    this.confidence = 0,
  });
}

class OcrExtractor {
  // EWC code pattern: 6 digits with optional space/dot separator (e.g. 17 09 04, 170904)
  static final _ewcPattern = RegExp(r'\b(\d{2}[\s.]?\d{2}[\s.]?\d{2})\b');

  // Vehicle registration (UK format, various styles)
  static final _vrPattern = RegExp(
    r'\b([A-Z]{2}\d{2}\s?[A-Z]{3}|[A-Z]{1,3}\s?\d{1,4}\s?[A-Z]{1,3})\b',
    caseSensitive: false,
  );

  // Prefer net weight when tickets include gross/tare/net rows.
  static final _netWeightPattern = RegExp(
    r'(?:net\s*(?:weight)?|weight\s*net)\D{0,24}(\d+(?:[.,]\d+)?)\s*(kg|kilograms?|tonne|tonnes|t\b|tons|lb)',
    caseSensitive: false,
  );

  // Weight: number followed by kg, tonne, t, tons, lb.
  static final _weightPattern = RegExp(
    r'(\d+(?:[.,]\d+)?)\s*(kg|kilograms?|tonne|tonnes|t\b|tons|lb)',
    caseSensitive: false,
  );

  // Date: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, or 15 Jun 2026.
  static final _datePattern = RegExp(
    r'\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{2}[\/\-]\d{2}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})\b',
    caseSensitive: false,
  );

  // Volume: number followed by litre, l, gallon, gal
  static final _volumePattern = RegExp(
    r'(\d+(?:[.,]\d+)?)\s*(litres?|liters?|l\b|gallons?|gal)',
    caseSensitive: false,
  );

  static final _quantityPattern = RegExp(
    r'(?:qty|quantity|load|loads|trips?|m3|cubic)\D{0,24}(\d+(?:[.,]\d+)?)\s*(m3|m³|cubic\s?metres?|loads?|trips?|items?|each|ea)?',
    caseSensitive: false,
  );

  static final _ticketReferencePattern = RegExp(
    r'(?:ticket|note|document|doc|ref|reference|wtn|docket)\s*(?:no|number|#|ref)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9\/-]{3,})',
    caseSensitive: false,
  );

  static final _postcodePattern = RegExp(
    r'\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b',
    caseSensitive: false,
  );

  static final _fuelPattern = RegExp(
    r'\b(diesel|red\s+diesel|hvo|petrol|gas\s*oil|adblue)\b',
    caseSensitive: false,
  );

  static ExtractedFields extract(String rawText, DocumentType type) {
    final lines = rawText
        .split(RegExp(r'[\r\n]+'))
        .map((line) => line.trim())
        .where((line) => line.isNotEmpty)
        .toList();
    final text = lines.join(' ');

    final weightMatch =
        _netWeightPattern.firstMatch(text) ?? _weightPattern.firstMatch(text);
    final ewcMatch = _ewcPattern.firstMatch(text);
    final dateMatch = _datePattern.firstMatch(text);
    final vrMatch = _vrPattern.firstMatch(text);
    final volumeMatch = _volumePattern.firstMatch(text);
    final quantityMatch = _quantityPattern.firstMatch(text);
    final ticketReference =
        _lineReference(lines) ?? _ticketReferencePattern.firstMatch(text)?.group(1);
    final postcodes = _postcodePattern
        .allMatches(text)
        .map((match) => _normalizePostcode(match.group(1)!))
        .toSet()
        .toList();

    final weightUnit = _normalizeUnit(weightMatch?.group(2));
    final volumeUnit = _normalizeUnit(volumeMatch?.group(2));
    final quantityUnit = _normalizeUnit(quantityMatch?.group(2));
    final supplierName = _lineValue(lines, [
      'supplier',
      'haulier',
      'carrier',
      'merchant',
      'company',
    ]);
    final materialType = _lineValue(lines, [
      'material',
      'waste description',
      'description',
      'product',
    ]);
    final fuelType = _fuelPattern.firstMatch(text)?.group(1)?.toLowerCase();

    final structuredCount = [
      weightMatch?.group(1),
      ewcMatch?.group(1),
      dateMatch?.group(0),
      vrMatch?.group(0),
      volumeMatch?.group(1),
      quantityMatch?.group(1),
      ticketReference,
      supplierName,
      materialType,
      fuelType,
      if (postcodes.isNotEmpty) postcodes.first,
    ].whereType<String>().length;
    final confidence = (structuredCount / 8).clamp(0, 1).toDouble();

    return ExtractedFields(
      documentType: type,
      weight: weightMatch?.group(1),
      weightUnit: weightUnit,
      ewcCode: ewcMatch?.group(1)?.replaceAll(RegExp(r'[\s.]'), ' ').trim(),
      date: dateMatch?.group(0),
      vehicleReg:
          vrMatch?.group(0)?.toUpperCase().replaceAll(RegExp(r'\s+'), ''),
      supplierName: supplierName,
      materialType: materialType,
      quantity: quantityMatch?.group(1),
      quantityUnit: quantityUnit,
      fuelType: fuelType,
      volume: volumeMatch?.group(1),
      volumeUnit: volumeUnit,
      ticketReference: ticketReference?.toUpperCase(),
      pickupPostcode: postcodes.isNotEmpty ? postcodes.first : null,
      deliveryPostcode: postcodes.length > 1 ? postcodes[1] : null,
      confidence: confidence,
    );
  }

  static String? _lineValue(List<String> lines, List<String> labels) {
    for (final line in lines) {
      for (final label in labels) {
        final pattern = RegExp(
          '^$label\\s*[:#-]?\\s*(.+)\$',
          caseSensitive: false,
        );
        final match = pattern.firstMatch(line);
        final value = match?.group(1)?.trim();
        if (value != null && value.length >= 2) return value;
      }
    }
    return null;
  }

  static String? _lineReference(List<String> lines) {
    for (final line in lines) {
      final match = RegExp(
        r'^(?:ticket|note|document|doc|ref|reference|wtn|docket)\s*(?:no|number|#|ref)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9\/-]{3,})\s*$',
        caseSensitive: false,
      ).firstMatch(line);
      final value = match?.group(1)?.trim();
      if (value != null && value.toLowerCase() != 'ticket') return value;
    }
    return null;
  }

  static String? _normalizeUnit(String? value) {
    if (value == null) return null;
    final lower = value.toLowerCase().replaceAll(RegExp(r'\s+'), ' ').trim();
    if (lower == 'tonne' || lower == 't' || lower == 'tons') return 'tonnes';
    if (lower == 'kilogram' || lower == 'kilograms') return 'kg';
    if (lower == 'litre' || lower == 'litres' || lower == 'liter') {
      return 'litres';
    }
    if (lower == 'l') return 'litres';
    if (lower == 'm³' || lower == 'm3' || lower.startsWith('cubic')) {
      return 'm3';
    }
    return lower;
  }

  static String _normalizePostcode(String value) {
    final compact = value.toUpperCase().replaceAll(RegExp(r'\s+'), '');
    if (compact.length <= 3) return compact;
    return '${compact.substring(0, compact.length - 3)} ${compact.substring(compact.length - 3)}';
  }
}
