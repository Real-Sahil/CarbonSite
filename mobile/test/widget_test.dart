import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'package:carbonsite_mobile/main.dart';

void main() {
  testWidgets('CarbonSite mobile app renders', (tester) async {
    FlutterSecureStorage.setMockInitialValues({});

    await tester.pumpWidget(const ProviderScope(child: CarbonSiteApp()));
    await tester.pumpAndSettle();

    expect(find.text('Set Your PIN'), findsOneWidget);
  });
}
