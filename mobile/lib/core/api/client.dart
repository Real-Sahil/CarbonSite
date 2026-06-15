import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _storage = FlutterSecureStorage();
const _configuredBaseUrl = String.fromEnvironment(
  'CARBONSITE_API_BASE_URL',
  defaultValue: 'http://localhost:3000',
);

// ---------------------------------------------------------------------------
// JWT refresh state — shared across all interceptors on the singleton client.
// ---------------------------------------------------------------------------

bool _isRefreshing = false;
final List<Completer<bool>> _pendingQueue = [];

/// Attempt a token refresh.  Returns `true` if a new token was obtained and
/// stored, `false` if the refresh failed (caller should clear the session).
Future<bool> _refreshToken(Dio dio) async {
  final currentToken = await _storage.read(key: 'session_token');
  if (currentToken == null || currentToken.isEmpty) return false;

  try {
    // Use a plain Dio instance without our interceptor so the refresh request
    // itself never triggers another 401 loop.
    final refreshDio = Dio(BaseOptions(
      baseUrl: dio.options.baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    final response = await refreshDio.post(
      '/api/auth/token',
      options: Options(
        headers: {'Authorization': 'Bearer $currentToken'},
      ),
    );

    final data = response.data;
    String? newToken;
    if (data is Map) {
      newToken = data['token'] as String? ??
          data['sessionToken'] as String? ??
          data['accessToken'] as String?;
    }

    if (newToken != null && newToken.isNotEmpty) {
      await _storage.write(key: 'session_token', value: newToken);
      return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

Dio createApiClient(String baseUrl) {
  final dio = Dio(BaseOptions(
    baseUrl: baseUrl,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 30),
    headers: {'Content-Type': 'application/json'},
  ));

  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) async {
      final token = await _storage.read(key: 'session_token');
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      handler.next(options);
    },
    onError: (error, handler) async {
      if (error.response?.statusCode != 401) {
        handler.next(error);
        return;
      }

      // Skip refresh loop for the refresh endpoint itself.
      final isRefreshRequest =
          error.requestOptions.path.contains('/api/auth/token');
      if (isRefreshRequest) {
        await _storage.delete(key: 'session_token');
        handler.next(error);
        return;
      }

      if (_isRefreshing) {
        // Queue this request until the in-flight refresh resolves.
        final completer = Completer<bool>();
        _pendingQueue.add(completer);
        final succeeded = await completer.future;
        if (!succeeded) {
          handler.next(error);
          return;
        }
        // Retry with the new token.
        try {
          final newToken = await _storage.read(key: 'session_token');
          final opts = error.requestOptions;
          if (newToken != null) {
            opts.headers['Authorization'] = 'Bearer $newToken';
          }
          final response = await dio.fetch(opts);
          handler.resolve(response);
        } catch (retryError) {
          handler.next(error);
        }
        return;
      }

      // This request is first to hit the 401 — take the refresh lock.
      _isRefreshing = true;
      final succeeded = await _refreshToken(dio);
      _isRefreshing = false;

      // Resolve all queued requesters.
      for (final completer in _pendingQueue) {
        completer.complete(succeeded);
      }
      _pendingQueue.clear();

      if (!succeeded) {
        // Refresh failed — clear the stale token and propagate the error.
        await _storage.delete(key: 'session_token');
        handler.next(error);
        return;
      }

      // Retry the original request with the new token.
      try {
        final newToken = await _storage.read(key: 'session_token');
        final opts = error.requestOptions;
        if (newToken != null) {
          opts.headers['Authorization'] = 'Bearer $newToken';
        }
        final response = await dio.fetch(opts);
        handler.resolve(response);
      } catch (retryError) {
        handler.next(error);
      }
    },
  ));

  return dio;
}

// Singleton client — recreated whenever the base URL changes.
Dio? _client;

Future<Dio> getClient() async {
  if (_client != null) return _client!;
  final storedBaseUrl = await _storage.read(key: 'api_base_url');
  final baseUrl = normalizeBaseUrl(storedBaseUrl ?? _configuredBaseUrl);
  _client = createApiClient(baseUrl);
  return _client!;
}

/// Call this after a logout or when the base URL changes so the next
/// [getClient] call creates a fresh instance.
void invalidateClient() {
  _client = null;
}

String normalizeBaseUrl(String value) {
  final uri = Uri.tryParse(value.trim());
  if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
    throw ArgumentError('CarbonSite API base URL must be an absolute URL.');
  }
  if (uri.scheme != 'https' && uri.host != 'localhost') {
    throw ArgumentError(
        'CarbonSite API base URL must use HTTPS outside localhost.');
  }
  return uri.replace(path: trimTrailingSlash(uri.path)).toString();
}

String trimTrailingSlash(String path) {
  if (path == '/') return '';
  return path.endsWith('/') ? path.substring(0, path.length - 1) : path;
}
