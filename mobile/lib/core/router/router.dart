import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/invite_screen.dart';
import '../../features/auth/pin_lock_screen.dart';
import '../../features/auth/pin_setup_screen.dart';
import '../../features/capture/capture_screen.dart';
import '../../features/dashboard/dashboard_screen.dart';
import '../../features/submissions/home_screen.dart';
import '../../features/submissions/submission_detail_screen.dart';
import '../../features/submissions/submissions_screen.dart';
import '../api/client.dart';
import '../notifications/fcm_handler.dart';
import 'main_shell.dart';

const _storage = FlutterSecureStorage();

final _rootNavigatorKey = GlobalKey<NavigatorState>();

/// Async provider that resolves to the current session token (null = not logged in).
final sessionTokenProvider = FutureProvider<String?>((ref) async {
  return _storage.read(key: 'session_token');
});

final routerProvider = Provider<GoRouter>((ref) {
  // Notification taps navigate through the root navigator.
  FcmHandler.setNavigatorKey(_rootNavigatorKey);
  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/',
    // Redirect is async-capable via GoRouter's refreshListenable pattern, but
    // for simplicity here we read storage directly in the redirect callback.
    redirect: (context, state) async {
      final token = await _storage.read(key: 'session_token');
      final path = state.uri.path;

      // Always allow invite deep links through regardless of auth state.
      if (path.startsWith('/invite')) return null;

      final hasSession = token != null && token.isNotEmpty;

      if (!hasSession && path != '/pin-setup') {
        return '/pin-setup';
      }

      // NOTE: authenticated users are allowed on /pin-setup — the invite flow
      // lands there right after acceptInvite stores the session. Bouncing to
      // /dashboard here made the PIN screen unreachable.

      // PIN gate: once per app process, a session with a stored PIN must
      // unlock before reaching the shell.
      if (hasSession &&
          !PinLock.unlocked &&
          path != '/pin-lock' &&
          path != '/pin-setup') {
        final pin = await _storage.read(key: 'pin');
        if (pin != null && pin.isNotEmpty) {
          return '/pin-lock';
        }
        // No PIN configured — nothing to verify.
        PinLock.unlocked = true;
      }

      if (path == '/') {
        return hasSession ? '/dashboard' : '/pin-setup';
      }

      return null; // no redirect
    },
    routes: [
      GoRoute(
        path: '/',
        redirect: (_, __) async {
          final token = await _storage.read(key: 'session_token');
          final hasSession = token != null && token.isNotEmpty;
          return hasSession ? '/dashboard' : '/pin-setup';
        },
      ),
      GoRoute(
        path: '/invite/:token',
        builder: (context, state) {
          final token = state.pathParameters['token'] ?? '';

          // Option A: Custom scheme carbonsite://app/invite/{token}?server=https://...
          // The ?server= param carries the web app's origin so we know where to call.
          final serverParam = state.uri.queryParameters['server'];
          if (serverParam != null &&
              serverParam.startsWith('https://') &&
              !serverParam.contains('localhost')) {
            _storage.write(key: 'api_base_url', value: serverParam);
            invalidateClient();
          } else {
            // Option B: HTTPS app link https://{host}/invite/{token}
            // Extract the server URL directly from the deep link host.
            final host = state.uri.host;
            final scheme = state.uri.scheme;
            if (host.isNotEmpty &&
                host != 'localhost' &&
                scheme == 'https') {
              _storage.write(key: 'api_base_url', value: 'https://$host');
              invalidateClient();
            }
          }

          return InviteScreen(token: token);
        },
      ),
      GoRoute(
        path: '/pin-setup',
        builder: (context, state) => const PinSetupScreen(),
      ),
      GoRoute(
        path: '/pin-lock',
        builder: (context, state) => const PinLockScreen(),
      ),

      // Main app: bottom-nav shell with three tabs.
      // No Reports tab: the app serves the field_worker role only, and the
      // org-wide reports API rightly denies that role (zero org-level access).
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            MainShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/dashboard',
                builder: (context, state) => const DashboardScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/home',
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/submissions',
                builder: (context, state) => const SubmissionsScreen(),
              ),
            ],
          ),
        ],
      ),

      // Capture flow renders above the shell (full screen, no nav bar).
      GoRoute(
        path: '/capture',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return CaptureScreen(
            projectId: state.uri.queryParameters['projectId'],
            projectLabel: state.uri.queryParameters['projectLabel'],
            resubmittedFromId: extra?['resubmittedFromId'] as String?,
            documentType: extra?['documentType'] as String?,
          );
        },
      ),
      GoRoute(
        path: '/submissions/:id',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => SubmissionDetailScreen(
          submissionId: state.pathParameters['id']!,
        ),
      ),
    ],
  );
});
