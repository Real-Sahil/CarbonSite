import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/router/router.dart';
import 'core/theme/app_theme.dart';
import 'features/sync/sync_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: CarbonSiteApp()));
}

class CarbonSiteApp extends ConsumerWidget {
  const CarbonSiteApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    // Boot the background sync service with the app — it listens for
    // connectivity and drains any drafts queued while offline.
    ref.watch(syncServiceProvider);

    return MaterialApp.router(
      title: 'CarbonSite',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      routerConfig: router,
    );
  }
}
