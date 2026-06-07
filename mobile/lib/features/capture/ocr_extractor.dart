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

  // Weight: number followed by kg, tonne, t, tons, lb
  static final _weightPattern = RegExp(
    r'(\d+(?:[.,]\d+)?)\s*(kg|tonne|tonnes|t\b|tons|lb)',
    caseSensitive: false,
  );

  // Date: DD/MM/YYYY or DD-MM-YYYY or YYYY-MM-DD
  static final _datePattern = RegExp(
    r'\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})\b',
  );

  // Volume: number followed by litre, l, gallon, gal
  static final _volumePattern = RegExp(
    r'(\d+(?:[.,]\d+)?)\s*(litres?|liters?|l\b|gallons?|gal)',
    caseSensitive: false,
  );

  static ExtractedFields extract(String rawText, DocumentType type) {
    final text = rawText.replaceAll('\n', ' ');

    final weightMatch = _weightPattern.firstMatch(text);
    final ewcMatch = _ewcPattern.firstMatch(text);
    final dateMatch = _datePattern.firstMatch(text);
    final vrMatch = _vrPattern.firstMatch(text);
    final volumeMatch = _volumePattern.firstMatch(text);

    return ExtractedFields(
      documentType: type,
      weight: weightMatch?.group(1),
      weightUnit: weightMatch?.group(2)?.toLowerCase(),
      ewcCode: ewcMatch?.group(1)?.replaceAll(RegExp(r'[\s.]'), ' ').trim(),
      date: dateMatch?.group(0),
      vehicleReg: vrMatch?.group(0)?.toUpperCase().replaceAll(RegExp(r'\s+'), ''),
      volume: volumeMatch?.group(1),
      volumeUnit: volumeMatch?.group(2)?.toLowerCase(),
    );
  }
}
