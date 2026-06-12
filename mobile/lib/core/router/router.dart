import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/invite_screen.dart';
import '../../features/auth/pin_setup_screen.dart';
import '../../features/capture/capture_screen.dart';
import '../../features/dashboard/dashboard_screen.dart';
import '../../features/submissions/home_screen.dart';
import '../../features/submissions/submissions_screen.dart';
import 'main_shell.dart';

const _storage = FlutterSecureStorage();

final _rootNavigatorKey = GlobalKey<NavigatorState>();

/// Async provider that resolves to the current session token (null = not logged in).
final sessionTokenProvider = FutureProvider<String?>((ref) async {
  return _storage.read(key: 'session_token');
});

final routerProvider = Provider<GoRouter>((ref) {
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

      if (hasSession && path == '/pin-setup') {
        return '/dashboard';
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
          return InviteScreen(token: token);
        },
      ),
      GoRoute(
        path: '/pin-setup',
        builder: (context, state) => const PinSetupScreen(),
      ),

      // Main app: bottom-nav shell with three tabs.
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
        builder: (context, state) => CaptureScreen(
          projectId: state.uri.queryParameters['projectId'],
          projectLabel: state.uri.queryParameters['projectLabel'],
        ),
      ),
    ],
  );
});
