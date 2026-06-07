import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/router/router.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: CarbonSiteApp()));
}

class CarbonSiteApp extends ConsumerWidget {
  const CarbonSiteApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'CarbonSite',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed:
            const Color(0xFF166534), // green-800 — sustainability green
        useMaterial3: true,
      ),
      routerConfig: router,
    );
  }
}
