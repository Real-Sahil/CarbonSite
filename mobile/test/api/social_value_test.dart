import 'package:flutter_test/flutter_test.dart';
import 'package:metricora_mobile/core/api/endpoints.dart';

void main() {
  group('SiteSocialValue.fromJson', () {
    test('reads the contract KPIs', () {
      final value = SiteSocialValue.fromJson({
        'enabled': true,
        'contractName': 'A61 corridor',
        'kpis': [
          {
            'id': 'c1',
            'title': 'Apprenticeship starts',
            'unit': 'starts',
            'target': 12,
            'criterion': 'Training and retraining',
          },
        ],
      });
      expect(value.enabled, isTrue);
      expect(value.contractName, 'A61 corridor');
      expect(value.kpis.single.title, 'Apprenticeship starts');
      expect(value.kpis.single.target, 12.0);
      expect(value.kpis.single.criterion, 'Training and retraining');
    });

    test('drops KPIs without an id and tolerates missing fields', () {
      final value = SiteSocialValue.fromJson({
        'kpis': [
          {'title': 'No id'},
          {'id': 'c2'},
        ],
      });
      expect(value.enabled, isFalse);
      expect(value.kpis.map((k) => k.id), ['c2']);
      expect(value.kpis.single.unit, isNull);
    });
  });
}
