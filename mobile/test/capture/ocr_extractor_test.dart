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
    });
  });
}
