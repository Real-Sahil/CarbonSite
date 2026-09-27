import 'package:flutter_test/flutter_test.dart';
import 'package:metricora_mobile/features/capture/site_safety_form.dart';

void main() {
  test('hazard report sends the server\'s kind values and a date', () {
    final data = buildHazardFormData(
      kind: HazardKind.nearMiss,
      description: '  Load swung over the walkway ',
      location: 'Gate 2',
      immediateAction: '',
      observedOn: DateTime(2026, 9, 7),
    );
    expect(data, {
      'kind': 'near_miss',
      'description': 'Load swung over the walkway',
      'location': 'Gate 2',
      'observedOn': '2026-09-07',
    });
  });

  test('inspection sends only answered items, with notes on failures', () {
    final data = buildInspectionFormData(
      templateId: 't1',
      templateTitle: 'Weekly environmental',
      location: 'Compound',
      inspectedOn: DateTime(2026, 9, 20),
      items: const ['Spill kit stocked', 'Wheel wash working', 'Skips covered'],
      results: const {'Spill kit stocked': InspectionResult.fail, 'Wheel wash working': InspectionResult.pass},
      notes: const {'Spill kit stocked': 'Empty', 'Wheel wash working': 'ignored'},
    );
    expect(data['results'], [
      {'item': 'Spill kit stocked', 'result': 'fail', 'note': 'Empty'},
      {'item': 'Wheel wash working', 'result': 'pass'},
    ]);
    expect(data['inspectedOn'], '2026-09-20');
  });
}
