import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _storage = FlutterSecureStorage();
const _tokenKey = 'access_token';
const _refreshKey = 'refresh_token';

Dio createApiClient(String baseUrl) {
  final dio = Dio(BaseOptions(
    baseUrl: baseUrl,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 30),
  ));

  // Auth interceptor — attaches JWT and auto-refreshes on 401
  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) async {
      final token = await _storage.read(key: _tokenKey);
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      handler.next(options);
    },
    onError: (error, handler) async {
      if (error.response?.statusCode == 401) {
        final refreshed = await _tryRefresh(dio);
        if (refreshed) {
          final token = await _storage.read(key: _tokenKey);
          error.requestOptions.headers['Authorization'] = 'Bearer $token';
          final retry = await dio.fetch(error.requestOptions);
          return handler.resolve(retry);
        }
      }
      handler.next(error);
    },
  ));

  return dio;
}

Future<bool> _tryRefresh(Dio dio) async {
  try {
    final refresh = await _storage.read(key: _refreshKey);
    if (refresh == null) return false;
    final res = await dio.post('/api/auth/refresh', data: {'refreshToken': refresh});
    await _storage.write(key: _tokenKey, value: res.data['accessToken'] as String);
    return true;
  } catch (_) {
    return false;
  }
}

Future<void> saveTokens({required String access, required String refresh}) async {
  await _storage.write(key: _tokenKey, value: access);
  await _storage.write(key: _refreshKey, value: refresh);
}

Future<void> clearTokens() async {
  await _storage.deleteAll();
}
