import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'package:carbonsite_mobile/main.dart';

void main() {
  testWidgets('CarbonSite mobile app renders invite entry on first run',
      (tester) async {
    FlutterSecureStorage.setMockInitialValues({});

    await tester.pumpWidget(const ProviderScope(child: CarbonSiteApp()));
    await tester.pumpAndSettle();

    expect(find.text('Join your CarbonSite project'), findsOneWidget);
    expect(find.text('Invite link or token'), findsOneWidget);
  });

  testWidgets('CarbonSite mobile app renders PIN setup with a session',
      (tester) async {
    FlutterSecureStorage.setMockInitialValues({'session_token': 'test-session'});

    await tester.pumpWidget(const ProviderScope(child: CarbonSiteApp()));
    await tester.pumpAndSettle();

    expect(find.text('Set Your PIN'), findsOneWidget);
  });
}
