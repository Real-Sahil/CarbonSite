import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _storage = FlutterSecureStorage();
const _configuredBaseUrl = String.fromEnvironment(
  'CARBONSITE_API_BASE_URL',
  defaultValue: 'http://localhost:3000',
);

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
      // 401: clear stale token and rethrow — caller (router) redirects to /pin-setup
      if (error.response?.statusCode == 401) {
        await _storage.delete(key: 'session_token');
      }
      handler.next(error);
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
    throw ArgumentError('CarbonSite API base URL must use HTTPS outside localhost.');
  }
  return uri.replace(path: trimTrailingSlash(uri.path)).toString();
}

String trimTrailingSlash(String path) {
  if (path == '/') return '';
  return path.endsWith('/') ? path.substring(0, path.length - 1) : path;
}
