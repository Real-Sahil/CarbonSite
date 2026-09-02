// OCR corpus regression tests.
// Each fixture file in test/capture/fixtures/ contains an array of
// {description, text, expected, expectNull?} entries. This test loads every
// corpus entry and verifies that OcrExtractor.extract() produces the expected
// field values, providing a stable regression baseline as the extractor evolves.

import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:carbonsite_mobile/features/capture/ocr_extractor.dart';

void main() {
  final corpusDir = Directory('test/capture/fixtures');

  final fileTypeMap = {
    'waste_tickets': DocumentType.wasteTicket,
    'delivery_notes': DocumentType.deliveryNote,
    'fuel_receipts': DocumentType.fuelReceipt,
  };

  for (final entry in fileTypeMap.entries) {
    final file = File('${corpusDir.path}/${entry.key}.json');
    if (!file.existsSync()) continue;

    final corpus =
        jsonDecode(file.readAsStringSync()) as List<dynamic>;
    final documentType = entry.value;

    group('OCR corpus — ${entry.key}', () {
      for (final item in corpus) {
        final description = item['description'] as String;
        final text = item['text'] as String;
        final expected = (item['expected'] as Map<String, dynamic>?) ?? {};
        final expectNull = (item['expectNull'] as List<dynamic>?)
                ?.map((e) => e as String)
                .toList() ??
            [];

        test(description, () {
          final result = OcrExtractor.extract(text, documentType);
          final map = result.toMap();

          for (final field in expected.entries) {
            expect(
              map[field.key],
              field.value,
              reason: 'field "${field.key}" mismatch',
            );
          }

          for (final field in expectNull) {
            expect(
              map.containsKey(field) ? map[field] : null,
              isNull,
              reason: 'field "$field" should be null',
            );
          }
        });
      }
    });
  }
}
