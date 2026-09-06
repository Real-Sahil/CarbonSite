import 'package:metricora_mobile/core/api/client.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('normalizeBaseUrl', () {
    test('accepts production HTTPS URLs', () {
      expect(
        normalizeBaseUrl('https://app.metricora.example/'),
        'https://app.metricora.example',
      );
    });

    test('accepts localhost for development', () {
      expect(
          normalizeBaseUrl('http://localhost:3000'), 'http://localhost:3000');
    });

    test('rejects non-HTTPS remote URLs', () {
      expect(
        () => normalizeBaseUrl('http://metricora.example'),
        throwsArgumentError,
      );
    });
  });
}
