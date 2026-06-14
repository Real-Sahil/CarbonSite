import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';

import '../api/client.dart';

const _storage = FlutterSecureStorage();

// Top-level handler required by FCM for background messages.
// Must be annotated @pragma('vm:entry-point') and defined at the top level.
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Firebase is already initialised by the time this is called.
  // Nothing to do here beyond what the notification system handles automatically.
  debugPrint('[FCM] Background message: ${message.messageId}');
}

class FcmHandler {
  FcmHandler._();

  static Future<void> initialise() async {
    // Register the background handler before any other Firebase calls.
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    final messaging = FirebaseMessaging.instance;

    // Request permission (iOS / macOS). On Android 13+ this shows a dialog.
    final settings = await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      debugPrint('[FCM] Push permission denied — skipping token registration.');
      return;
    }

    // Register/refresh the token whenever it changes.
    messaging.onTokenRefresh.listen(_registerToken);

    // Register the current token immediately on startup.
    final token = await messaging.getToken();
    if (token != null) await _registerToken(token);

    // Handle foreground messages (show a snackbar/in-app banner).
    FirebaseMessaging.onMessage.listen(_handleForeground);

    // Handle tap on a notification that launched/resumed the app.
    FirebaseMessaging.onMessageOpenedApp.listen(_handleTap);

    // Handle the case where the app was terminated and opened via notification.
    final initial = await messaging.getInitialMessage();
    if (initial != null) _handleTap(initial);
  }

  static Future<void> deregister() async {
    final token = await FirebaseMessaging.instance.getToken();
    if (token == null) return;
    try {
      final client = await getClient();
      await client.delete(
        '/api/push-tokens',
        data: {'token': token},
        options: Options(headers: {'Content-Type': 'application/json'}),
      );
      await FirebaseMessaging.instance.deleteToken();
    } catch (e) {
      debugPrint('[FCM] Failed to deregister token: $e');
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  static Future<void> _registerToken(String token) async {
    final sessionToken = await _storage.read(key: 'session_token');
    if (sessionToken == null || sessionToken.isEmpty) return;

    try {
      final platform = defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android';
      final client = await getClient();
      await client.post(
        '/api/push-tokens',
        data: jsonEncode({'token': token, 'platform': platform}),
        options: Options(headers: {'Content-Type': 'application/json'}),
      );
      debugPrint('[FCM] Device token registered.');
    } catch (e) {
      debugPrint('[FCM] Failed to register token: $e');
    }
  }

  static void _handleForeground(RemoteMessage message) {
    final title = message.notification?.title ?? 'CarbonSite';
    final body = message.notification?.body ?? '';
    debugPrint('[FCM] Foreground: $title — $body');
    // The foreground notification is handled by the in-app SnackBar banner
    // wired up in main.dart via the navigatorKey.
    for (final handler in _foregroundNotificationHandlers) {
      handler(message);
    }
  }

  static void _handleTap(RemoteMessage message) {
    final data = message.data;
    final type = data['type'] as String?;
    final orgId = data['orgId'] as String?;
    debugPrint('[FCM] Tap: type=$type orgId=$orgId');

    if (_navigatorKey?.currentContext == null) return;
    final context = _navigatorKey!.currentContext!;

    switch (type) {
      case 'submission_reviewed':
        final submissionId = data['submissionId'] as String?;
        if (submissionId != null && submissionId.isNotEmpty) {
          GoRouter.of(context).push('/submissions/$submissionId');
        } else {
          GoRouter.of(context).go('/submissions');
        }
        break;
      case 'report_ready':
        GoRouter.of(context).go('/reports');
        break;
      case 'task_assigned':
        GoRouter.of(context).go('/submissions');
        break;
      default:
        GoRouter.of(context).go('/dashboard');
    }
  }

  // ── Public registration points ─────────────────────────────────────────────

  static GlobalKey<NavigatorState>? _navigatorKey;

  static void setNavigatorKey(GlobalKey<NavigatorState> key) {
    _navigatorKey = key;
  }

  static final List<void Function(RemoteMessage)> _foregroundNotificationHandlers = [];

  static void addForegroundHandler(void Function(RemoteMessage) handler) {
    _foregroundNotificationHandlers.add(handler);
  }

  static void removeForegroundHandler(void Function(RemoteMessage) handler) {
    _foregroundNotificationHandlers.remove(handler);
  }

  // ── Background message handler + pending navigation ────────────────────────

  static const _pendingStorage = FlutterSecureStorage();

  /// Call once at app startup after Firebase.initializeApp().
  static void setupBackgroundMessageHandler() {
    // App opened from terminated state by notification tap
    FirebaseMessaging.instance.getInitialMessage().then((message) {
      if (message != null) _handleNotificationOpen(message);
    });

    // App in background, user taps notification
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationOpen);
  }

  static void _handleNotificationOpen(RemoteMessage message) {
    final submissionId = message.data['submissionId'] as String?;
    if (submissionId != null && submissionId.isNotEmpty) {
      _pendingStorage.write(key: 'pending_navigation_target', value: '/submissions/$submissionId');
    }
  }

  /// Call in a widget's initState to check for a pending deep link.
  static Future<void> consumePendingNavigation(BuildContext context) async {
    final target = await _pendingStorage.read(key: 'pending_navigation_target');
    if (target == null || target.isEmpty) return;
    await _pendingStorage.delete(key: 'pending_navigation_target');
    if (context.mounted) {
      GoRouter.of(context).push(target);
    }
  }
}
