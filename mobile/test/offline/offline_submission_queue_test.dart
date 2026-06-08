import 'package:flutter_test/flutter_test.dart';
import 'package:carbonsite_mobile/core/offline/offline_submission_queue.dart';

void main() {
  group('QueuedSubmission', () {
    test('round-trips the offline submission payload', () {
      const submission = QueuedSubmission(
        id: 'period-123-1',
        orgId: 'org-123',
        reportingPeriodId: 'period-123',
        documentType: 'waste_ticket',
        formData: {
          'amount': 2.5,
          'unit': 'tonnes',
          'supplierName': 'Northbank Haulage',
        },
        idempotencyKey: 'period-123-1',
        createdAt: '2026-06-08T09:00:00.000Z',
        evidencePath: '/tmp/evidence.jpg',
        evidenceFilename: 'evidence.jpg',
        evidenceContentType: 'image/jpeg',
        pickupPostcode: 'SW1A 1AA',
        deliveryPostcode: 'M1 1AE',
        gpsLat: 51.501,
        gpsLng: -0.141,
      );

      final restored = QueuedSubmission.fromJson(submission.toJson());

      expect(restored.id, submission.id);
      expect(restored.orgId, submission.orgId);
      expect(restored.reportingPeriodId, submission.reportingPeriodId);
      expect(restored.documentType, submission.documentType);
      expect(restored.formData['amount'], 2.5);
      expect(restored.formData['supplierName'], 'Northbank Haulage');
      expect(restored.idempotencyKey, submission.idempotencyKey);
      expect(restored.evidencePath, submission.evidencePath);
      expect(restored.pickupPostcode, submission.pickupPostcode);
      expect(restored.deliveryPostcode, submission.deliveryPostcode);
      expect(restored.gpsLat, submission.gpsLat);
      expect(restored.gpsLng, submission.gpsLng);
    });
  });
}
