import 'package:flutter_test/flutter_test.dart';
import 'package:carbonsite_mobile/features/capture/ocr_extractor.dart';

void main() {
  group('OcrExtractor — waste ticket', () {
    test('extracts weight in tonnes', () {
      const text =
          'Waste Transfer Note\nWeight: 2.5 tonnes\nDate: 15/06/2026\nVehicle: AB12 CDE';
      final result = OcrExtractor.extract(text, DocumentType.wasteTicket);
      expect(result.weight, '2.5');
      expect(result.weightUnit, 'tonnes');
      expect(result.date, '15/06/2026');
      expect(result.vehicleReg, 'AB12CDE');
    });

    test('extracts EWC code with spaces', () {
      const text = 'EWC Code: 17 09 04\nInert waste from construction';
      final result = OcrExtractor.extract(text, DocumentType.wasteTicket);
      expect(result.ewcCode, '17 09 04');
    });

    test('extracts EWC code without separators', () {
      const text = 'EWC: 170904 mixed construction waste';
      final result = OcrExtractor.extract(text, DocumentType.wasteTicket);
      expect(result.ewcCode, isNotNull);
    });

    test('prefers net weight and extracts ticket metadata', () {
      const text = '''
Waste Transfer Note
Ticket No: WTN-49382
Supplier: North Kent Haulage Ltd
Material: Mixed construction waste
Gross Weight: 12.4 tonnes
Tare Weight: 8.1 tonnes
Net Weight: 4.3 tonnes
Vehicle: AB12 CDE
From: SW1A 1AA
To: EC1A 1BB
''';
      final result = OcrExtractor.extract(text, DocumentType.wasteTicket);
      expect(result.weight, '4.3');
      expect(result.weightUnit, 'tonnes');
      expect(result.ticketReference, 'WTN-49382');
      expect(result.supplierName, 'North Kent Haulage Ltd');
      expect(result.materialType, 'Mixed construction waste');
      expect(result.pickupPostcode, 'SW1A 1AA');
      expect(result.deliveryPostcode, 'EC1A 1BB');
      expect(result.confidence, greaterThan(0.6));
    });

    test('handles missing fields gracefully', () {
      const text = 'Some random text with no structured data';
      final result = OcrExtractor.extract(text, DocumentType.wasteTicket);
      expect(result.weight, isNull);
      expect(result.ewcCode, isNull);
      expect(result.vehicleReg, isNull);
    });
  });

  group('OcrExtractor — fuel receipt', () {
    test('extracts volume in litres', () {
      const text = 'Fuel Receipt\n42.5 litres diesel\nDate: 10-06-2026';
      final result = OcrExtractor.extract(text, DocumentType.fuelReceipt);
      expect(result.volume, '42.5');
      expect(result.volumeUnit, contains('litre'));
      expect(result.fuelType, 'diesel');
    });
  });

  group('OcrExtractor delivery note', () {
    test('extracts quantity and supplier fields', () {
      const text = '''
Delivery Note DN-7781
Supplier: ReadyMix South
Product: C40 concrete
Quantity: 6.5 m3
Date: 15 Jun 2026
''';
      final result = OcrExtractor.extract(text, DocumentType.deliveryNote);
      expect(result.ticketReference, 'DN-7781');
      expect(result.supplierName, 'ReadyMix South');
      expect(result.materialType, 'C40 concrete');
      expect(result.quantity, '6.5');
      expect(result.quantityUnit, 'm3');
      expect(result.date, '15 Jun 2026');
    });
  });
}
