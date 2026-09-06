import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'package:metricora_mobile/main.dart';

void main() {
  testWidgets('MetricOra mobile app renders invite entry on first run',
      (tester) async {
    FlutterSecureStorage.setMockInitialValues({});

    await tester.pumpWidget(const ProviderScope(child: MetricOraApp()));
    await tester.pumpAndSettle();

    expect(find.text('Join your MetricOra project'), findsOneWidget);
    expect(find.text('Paste invite link here'), findsOneWidget);
  });

  testWidgets('MetricOra mobile app renders dashboard shell with a session',
      (tester) async {
    FlutterSecureStorage.setMockInitialValues({'session_token': 'test-session'});

    await tester.pumpWidget(const ProviderScope(child: MetricOraApp()));
    await tester.pumpAndSettle();

    // With a valid session the router navigates to /dashboard inside the
    // main shell — the bottom nav bar is always present.
    expect(find.text('Submissions'), findsOneWidget);
  });
}
