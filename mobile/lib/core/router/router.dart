import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/invite_screen.dart';
import '../../features/auth/pin_setup_screen.dart';
import '../../features/submissions/home_screen.dart';
import '../../features/submissions/submissions_screen.dart';
import '../../features/capture/capture_screen.dart';

const _storage = FlutterSecureStorage();

/// Async provider that resolves to the current session token (null = not logged in).
final sessionTokenProvider = FutureProvider<String?>((ref) async {
  return _storage.read(key: 'session_token');
});

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
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
        return '/home';
      }

      if (path == '/') {
        return hasSession ? '/home' : '/pin-setup';
      }

      return null; // no redirect
    },
    routes: [
      GoRoute(
        path: '/',
        redirect: (_, __) async {
          final token = await _storage.read(key: 'session_token');
          final hasSession = token != null && token.isNotEmpty;
          return hasSession ? '/home' : '/pin-setup';
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
      GoRoute(
        path: '/home',
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/submissions',
        builder: (context, state) => const SubmissionsScreen(),
      ),
      GoRoute(
        path: '/capture',
        builder: (context, state) => const CaptureScreen(),
      ),
    ],
  );
});
