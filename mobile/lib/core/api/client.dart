import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _storage = FlutterSecureStorage();

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
  final baseUrl =
      await _storage.read(key: 'api_base_url') ?? 'http://localhost:3000';
  _client = createApiClient(baseUrl);
  return _client!;
}

/// Call this after a logout or when the base URL changes so the next
/// [getClient] call creates a fresh instance.
void invalidateClient() {
  _client = null;
}
