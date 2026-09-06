import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map_tile_caching/flutter_map_tile_caching.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/notifications/fcm_handler.dart';
import 'core/router/router.dart';
import 'core/theme/app_theme.dart';
import 'features/sync/sync_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase must be initialised before anything else touches it.
  // If GOOGLE_SERVICES_JSON / GoogleService-Info.plist are absent in the build
  // (e.g. CI without secrets) this will throw — catch and continue without FCM.
  try {
    await Firebase.initializeApp();
    await FcmHandler.initialise();
    FcmHandler.setupBackgroundMessageHandler();
  } catch (e) {
    debugPrint('[FCM] Firebase initialisation skipped: $e');
  }

  // Initialise the offline map tile cache. A single persistent store covers
  // all areas — tiles are cached on first online view and served from disk
  // on subsequent visits regardless of connectivity.
  try {
    await FMTCObjectBoxBackend().initialise();
    await const FMTCStore('mainStore').manage.create();
  } catch (e) {
    debugPrint('[FMTC] Map tile cache initialisation skipped: $e');
  }

  runApp(const ProviderScope(child: MetricOraApp()));
}

class MetricOraApp extends ConsumerStatefulWidget {
  const MetricOraApp({super.key});

  @override
  ConsumerState<MetricOraApp> createState() => _MetricOraAppState();
}

class _MetricOraAppState extends ConsumerState<MetricOraApp> {
  final _scaffoldKey = GlobalKey<ScaffoldMessengerState>();

  @override
  void initState() {
    super.initState();
    FcmHandler.addForegroundHandler(_showForegroundBanner);
  }

  @override
  void dispose() {
    FcmHandler.removeForegroundHandler(_showForegroundBanner);
    super.dispose();
  }

  void _showForegroundBanner(RemoteMessage message) {
    final title = message.notification?.title ?? 'MetricOra';
    final body = message.notification?.body ?? '';
    _scaffoldKey.currentState?.showSnackBar(
      SnackBar(
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
            if (body.isNotEmpty) Text(body, style: const TextStyle(fontSize: 13)),
          ],
        ),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 4),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    ref.watch(syncServiceProvider);

    return MaterialApp.router(
      title: 'MetricOra',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      routerConfig: router,
      scaffoldMessengerKey: _scaffoldKey,
    );
  }
}
