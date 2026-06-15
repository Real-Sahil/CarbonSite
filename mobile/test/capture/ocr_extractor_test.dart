import 'package:flutter_test/flutter_test.dart';
import 'package:carbonsite_mobile/features/capture/ocr_extractor.dart';

void main() {
  group('OcrExtractor — waste ticket', () {
    test('extracts weight in tonnes', () {
      const text = 'Waste Transfer Note\nWeight: 2.5 tonnes\nDate: 15/06/2026\nVehicle: AB12 CDE';
      final result = OcrExtractor.extract(text, DocumentType.wasteTicket);
      expect(result.weight, '2.5');
      expect(result.weightUnit, 'tonnes');
      expect(result.date, '15/06/2026');
      expect(result.vehicleReg, 'AB12CDE');
    });

    test('extracts weight in kg', () {
      const text = 'Net weight: 850 kg\nSkip exchange';
      final result = OcrExtractor.extract(text, DocumentType.wasteTicket);
      expect(result.weight, '850');
      expect(result.weightUnit, 'kg');
    });

    test('normalises thousands separator in weight', () {
      const text = 'Weight 1,250 kg of inert waste';
      final result = OcrExtractor.extract(text, DocumentType.wasteTicket);
      expect(result.weight, '1250');
      expect(result.weightUnit, 'kg');
    });

    test('prefers net weight over gross', () {
      const text = 'Gross: 12.4 tonnes\nTare: 6.2 tonnes\nNet: 6.2 tonnes';
      final result = OcrExtractor.extract(text, DocumentType.wasteTicket);
      // First "net"-labelled line wins, not the first weight in the document.
      expect(result.weight, '6.2');
      expect(result.weightUnit, 'tonnes');
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

    test('normalises contiguous EWC code after label', () {
      const text = 'EWC 170107 concrete, bricks, tiles';
      final result = OcrExtractor.extract(text, DocumentType.wasteTicket);
      expect(result.ewcCode, '17 01 07');
    });

    test('rejects EWC code with invalid chapter', () {
      const text = 'Ref 99 99 99 on this ticket';
      final result = OcrExtractor.extract(text, DocumentType.wasteTicket);
      expect(result.ewcCode, isNull);
    });

    test('does not mistake a date for an EWC code', () {
      const text = 'Date: 15/06/2026';
      final result = OcrExtractor.extract(text, DocumentType.wasteTicket);
      expect(result.ewcCode, isNull);
      expect(result.date, '15/06/2026');
    });

    test('handles missing fields gracefully', () {
      const text = 'Some random text with no structured data';
      final result = OcrExtractor.extract(text, DocumentType.wasteTicket);
      expect(result.weight, isNull);
      expect(result.ewcCode, isNull);
      expect(result.vehicleReg, isNull);
    });
  });

  group('OcrExtractor — dates', () {
    test('extracts dd/mm/yyyy', () {
      final result = OcrExtractor.extract(
          'Issued 09/01/2026', DocumentType.wasteTicket);
      expect(result.date, '09/01/2026');
    });

    test('extracts dd-mm-yyyy', () {
      final result = OcrExtractor.extract(
          'Issued 10-06-2026 site A', DocumentType.wasteTicket);
      expect(result.date, '10-06-2026');
    });

    test('extracts dd MMM yyyy', () {
      final result = OcrExtractor.extract(
          'Collected on 12 Mar 2026 from site', DocumentType.wasteTicket);
      expect(result.date, '12 Mar 2026');
    });

    test('extracts written date with ordinal and full month', () {
      final result = OcrExtractor.extract(
          'Delivered 3rd March 2026 to compound', DocumentType.deliveryNote);
      expect(result.date, '3rd March 2026');
    });
  });

  group('OcrExtractor — vehicle registrations', () {
    test('extracts current format AB12 CDE', () {
      final result = OcrExtractor.extract(
          'Vehicle: LX71 GHB tipper', DocumentType.wasteTicket);
      expect(result.vehicleReg, 'LX71GHB');
    });

    test('extracts prefix format P123 XYZ', () {
      final result = OcrExtractor.extract(
          'Reg: P123 XYZ grab lorry', DocumentType.wasteTicket);
      expect(result.vehicleReg, 'P123XYZ');
    });

    test('extracts suffix format ABC 123D', () {
      final result = OcrExtractor.extract(
          'Plate ABC 123D on site', DocumentType.wasteTicket);
      expect(result.vehicleReg, 'ABC123D');
    });
  });

  group('OcrExtractor — supplier names', () {
    test('extracts labelled carrier', () {
      const text = 'Waste Transfer Note\nCarrier: Greenway Skips Ltd\nWeight 2 tonnes';
      final result = OcrExtractor.extract(text, DocumentType.wasteTicket);
      expect(result.supplierName, 'Greenway Skips Ltd');
    });

    test('extracts company-suffix line', () {
      const text = 'Acme Aggregates Limited\nDelivery of sub-base material';
      final result = OcrExtractor.extract(text, DocumentType.deliveryNote);
      expect(result.supplierName, 'Acme Aggregates Limited');
    });
  });

  group('OcrExtractor — fuel receipt', () {
    test('extracts volume in litres', () {
      const text = 'Fuel Receipt\n42.5 litres diesel\nDate: 10-06-2026';
      final result = OcrExtractor.extract(text, DocumentType.fuelReceipt);
      expect(result.volume, '42.5');
      expect(result.volumeUnit, contains('litre'));
    });

    test('extracts fuel type and volume with unit shorthand', () {
      const text = 'Forecourt 7\nUnleaded 38.20 L\n12/05/2026';
      final result = OcrExtractor.extract(text, DocumentType.fuelReceipt);
      expect(result.fuelType, 'unleaded');
      expect(result.volume, '38.20');
      expect(result.volumeUnit, 'litres');
    });

    test('prefers longer fuel keyword (red diesel over diesel)', () {
      const text = 'Red Diesel 120 litres delivered to generator';
      final result = OcrExtractor.extract(text, DocumentType.fuelReceipt);
      expect(result.fuelType, 'red diesel');
      expect(result.volume, '120');
    });
  });

  group('OcrExtractor — postcode', () {
    test('extracts a standard UK postcode', () {
      const text = 'Delivery to site\nLondon SW1A 1AA\nDate: 15/06/2026';
      final result = OcrExtractor.extract(text, DocumentType.deliveryNote);
      expect(result.postcode, 'SW1A 1AA');
    });

    test('normalises a postcode without an internal space', () {
      const text = 'Site address: M11AE';
      final result = OcrExtractor.extract(text, DocumentType.deliveryNote);
      expect(result.postcode, 'M1 1AE');
    });

    test('returns null when no postcode present', () {
      const text = 'Concrete blocks delivered';
      final result = OcrExtractor.extract(text, DocumentType.deliveryNote);
      expect(result.postcode, isNull);
    });
  });

  group('OcrExtractor — material type', () {
    test('extracts labelled material', () {
      const text = 'Delivery Note\nMaterial: Concrete blocks\nQty: 1250 kg';
      final result = OcrExtractor.extract(text, DocumentType.deliveryNote);
      expect(result.materialType, 'Concrete blocks');
    });

    test('extracts labelled product/description variants', () {
      const text = 'Description: Crushed aggregate Type 1';
      final result = OcrExtractor.extract(text, DocumentType.deliveryNote);
      expect(result.materialType, 'Crushed aggregate Type 1');
    });

    test('returns null when material is unlabelled', () {
      const text = 'Some random text with no material label';
      final result = OcrExtractor.extract(text, DocumentType.deliveryNote);
      expect(result.materialType, isNull);
    });
  });

  group('OcrExtractor — toMap', () {
    test('only includes extracted fields', () {
      const text = 'Weight: 2.5 tonnes';
      final result = OcrExtractor.extract(text, DocumentType.wasteTicket);
      final map = result.toMap();
      expect(map['weight'], '2.5');
      expect(map['weightUnit'], 'tonnes');
      expect(map.containsKey('ewcCode'), isFalse);
      expect(map.containsKey('vehicleReg'), isFalse);
    });

    test('includes postcode and material when present', () {
      const text = 'Material: Sand\nSite: B33 8TH';
      final result = OcrExtractor.extract(text, DocumentType.deliveryNote);
      final map = result.toMap();
      expect(map['materialType'], 'Sand');
      expect(map['postcode'], 'B33 8TH');
    });
  });
}
