# Flutter Audit — CarbonSite Mobile

---

## Summary

The Flutter app is in early Milestone 1 state. The auth flow (invite → PIN setup → home) is fully implemented. The home screen fetches projects. The capture screen and submissions screen are explicit TODO stubs. The OCR extractor is implemented and unit-tested. Most architecture patterns are sound but several have structural problems that will be expensive to fix later.

---

## 1. Riverpod Implementation

### Current State
Only two Riverpod providers exist:
- `sessionTokenProvider` — `FutureProvider<String?>` reading `flutter_secure_storage`
- `routerProvider` — `Provider<GoRouter>` creating the router

All data fetching in `HomeScreen` is performed directly in `_HomeScreenState.initState()` without a provider.

### Issues

**Severity: High**

**Issue: No StateNotifier/AsyncNotifier for data**  
File: `mobile/lib/features/submissions/home_screen.dart`

The home screen manages loading, error, and data state entirely in local widget state (`_loading`, `_error`, `_projects`). This means:
- State is lost on screen pop/push
- No shared state across widgets
- Cannot be tested independently of the widget
- `initState()` fires async work without cancellation safety

**Recommended fix:**
```dart
// lib/features/submissions/providers.dart
@riverpod
Future<List<Project>> projects(ProjectsRef ref) async {
  final orgId = await ref.watch(orgIdProvider.future);
  if (orgId == null) return [];
  return getProjects(orgId);
}

// In widget:
class HomeScreen extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final projects = ref.watch(projectsProvider);
    return projects.when(
      data: (data) => _buildList(data),
      loading: () => const CircularProgressIndicator(),
      error: (e, _) => ErrorView(message: e.toString()),
    );
  }
}
```

---

**Severity: High**

**Issue: `sessionTokenProvider` is not reactive**  
File: `mobile/lib/core/router/router.dart:14`

```dart
final sessionTokenProvider = FutureProvider<String?>((ref) async {
  return _storage.read(key: 'session_token');
});
```

This provider reads storage once. When the token is written (after invite accept) or deleted (on 401), the provider does not update. The router's redirect callback also reads storage directly rather than watching this provider.

**Recommended fix:**
```dart
// Use a StateNotifierProvider that wraps secure storage
@riverpod
class AuthState extends _$AuthState {
  @override
  Future<String?> build() => _storage.read(key: 'session_token');

  Future<void> setToken(String token) async {
    await _storage.write(key: 'session_token', value: token);
    state = AsyncData(token);
  }

  Future<void> clearToken() async {
    await _storage.delete(key: 'session_token');
    state = const AsyncData(null);
  }
}

// Router uses a ChangeNotifier to re-trigger on auth state change
final routerProvider = Provider<GoRouter>((ref) {
  final notifier = _AuthNotifier(ref);
  return GoRouter(
    refreshListenable: notifier,
    redirect: (context, state) {
      final token = ref.read(authStateProvider).valueOrNull;
      // ...
    },
  );
});
```

---

## 2. Widget Structure

### Issues

**Severity: Medium**

**Issue: `InviteScreen` has no error state reset**  
File: `mobile/lib/features/auth/invite_screen.dart`

`_loading` is never reset to `false` on the success path — the screen navigates away via `context.go('/pin-setup')` but if navigation fails, the button stays disabled forever.

**Recommended fix:** Add `_loading = false` in a `finally` block.

---

**Severity: Medium**

**Issue: `PinSetupScreen` stores PIN but never reads it**  
File: `mobile/lib/features/auth/pin_setup_screen.dart`

The PIN is saved to `flutter_secure_storage` under key `'user_pin'` after setup, but no subsequent screen reads or verifies it. There is no lock screen, no biometric gate, and no re-authentication flow. The PIN is security theatre at present.

**Recommended fix:** Implement a lock screen that reads the stored PIN and verifies a re-entered value. Add a `LocalAuthService` that checks the PIN on cold start.

---

**Severity: Low**

**Issue: `CaptureScreen` and `SubmissionsScreen` are explicit stubs**  
Files: `mobile/lib/features/capture/capture_screen.dart`, `mobile/lib/features/submissions/submissions_screen.dart`

Both render a `Center(child: Text('TODO: Milestone 2'))`. The FAB in `SubmissionsScreen` navigates to `/capture` which shows another stub.

---

## 3. Performance Issues

**Severity: Medium**

**Issue: No image compression before upload**  
The architecture specifies evidence photos uploaded to R2 via presigned URLs. No compression pipeline exists yet (`image_cropper` is declared as a dependency). Mobile cameras produce 8–15 MB JPEG files. Without compression before upload, evidence files will be 10–50× larger than necessary and slow to sync on construction site networks.

**Recommended fix:** After capture, pass through `image_cropper` or `flutter_image_compress` before upload.

---

**Issue: `getClient()` can create multiple instances under concurrent invocation**  
File: `mobile/lib/core/api/client.dart:33`

```dart
Future<Dio> getClient() async {
  if (_client != null) return _client!;           // not thread-safe
  final baseUrl = await _storage.read(key: 'api_base_url') ?? 'http://localhost:3000';
  _client = createApiClient(baseUrl);
  return _client!;
}
```

Two concurrent calls can both see `_client == null`, both create instances, and the second write wins — discarding the first client's interceptors.

**Recommended fix:** Use a `Completer<Dio>` mutex or initialize the client eagerly at app start.

---

## 4. Navigation Architecture

**Severity: High**

**Issue: GoRouter redirect reads storage directly, not from Riverpod**  
File: `mobile/lib/core/router/router.dart:19`

```dart
redirect: (context, state) async {
  final token = await _storage.read(key: 'session_token');
```

And the `/` route has a duplicate redirect:
```dart
GoRoute(
  path: '/',
  redirect: (_, __) async {
    final token = await _storage.read(key: 'session_token');
```

Storage is read twice per navigation attempt. More critically, GoRouter's redirect without `refreshListenable` will not re-run when auth state changes — the router is effectively static after first build.

---

**Severity: Medium**

**Issue: `api_base_url` from storage is a phishing vector**  
File: `mobile/lib/core/api/client.dart:35`

```dart
final baseUrl = await _storage.read(key: 'api_base_url') ?? 'http://localhost:3000';
```

Any code or SDK that can write to `flutter_secure_storage` could redirect API calls to an attacker-controlled server. The base URL should be compile-time or environment-compile constant, not configurable at runtime from storage.

**Recommended fix:** Use `const String baseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'https://app.carbonsite.co')` or a build flavor approach.

---

## 5. Error Handling

**Severity: High**

**Issue: No global error boundary in Flutter app**  
File: `mobile/lib/main.dart`

```dart
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: CarbonSiteApp()));
}
```

No `FlutterError.onError`, no `PlatformDispatcher.instance.onError`, no error reporting to any service. Unhandled exceptions in release mode will silently crash the app with no trace.

**Recommended fix:**
```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    // TODO: Sentry.captureException(details.exception, stackTrace: details.stack);
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    // TODO: Sentry.captureException(error, stackTrace: stack);
    return true;
  };
  runApp(const ProviderScope(child: CarbonSiteApp()));
}
```

---

## 6. Offline Handling

**Severity: High**

**Issue: Drift schema and sync service do not exist**  
`pubspec.yaml` declares `drift`, `sqlite3_flutter_libs`, `path_provider`, `path`, and `connectivity_plus` as dependencies. None of these are used in any Dart file. There is no:
- `lib/core/storage/database.dart` (drift schema)
- `lib/features/sync/sync_service.dart`
- Any `connectivity_plus` usage

The architecture document specifies offline-first as a core requirement for construction site use cases. Currently the app will fail silently if there is no network when a submission is attempted.

**Required implementation:**
```dart
// lib/core/storage/database.dart
@DriftDatabase(tables: [SubmissionDrafts, SyncQueue])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());
  @override
  int get schemaVersion => 1;
}
```

---

## 7. OCR Extractor

**Severity: Low**

**Issue: `supplierName`, `materialType`, and `fuelType` fields are never populated**  
File: `mobile/lib/features/capture/ocr_extractor.dart`

`ExtractedFields` has `supplierName`, `materialType`, and `fuelType` properties. `OcrExtractor.extract()` never assigns them — all three are always `null`. The extractor is partially implemented.

**Issue: EWC code regex has false positive risk**  
The pattern `\b(\d{2}[\s.]?\d{2}[\s.]?\d{2})\b` will match any 6-digit sequence like phone number suffixes, invoice numbers, or reference codes. Should require EWC-specific context prefix.

**Recommended fix:**
```dart
// More targeted — require nearby keyword context
static final _ewcPattern = RegExp(
  r'(?:EWC|ewc|waste\s+code)[:\s]+(\d{2}[\s.]?\d{2}[\s.]?\d{2})',
  caseSensitive: false,
);
```

---

## 8. Accessibility

**Severity: High — see dedicated ACCESSIBILITY_AUDIT.md**

Zero `Semantics` widgets in the Flutter codebase. The PIN pad, invite form, home screen, and all navigation elements lack screen reader labels.

---

## 9. State Management Quality Summary

| Feature | Pattern Used | Quality |
|---|---|---|
| Auth (session token) | `FutureProvider` (one-shot) | Poor — not reactive |
| Router | `Provider<GoRouter>` | Medium — missing `refreshListenable` |
| Projects list | Widget-local `setState` | Poor — no caching, no reuse |
| Field submissions | Not yet implemented | N/A |
| OCR result | Not yet implemented | N/A |
| Offline queue | Not yet implemented | N/A |

---

## Dependency Versions

| Package | Version | Notes |
|---|---|---|
| `flutter_riverpod` | ^2.6.1 | Current stable — good |
| `go_router` | ^14.6.2 | Current stable — good |
| `dio` | ^5.7.0 | Current stable — good |
| `drift` | ^2.20.3 | Current stable — declared but unused |
| `google_mlkit_text_recognition` | ^0.15.0 | Current — good |
| `connectivity_plus` | ^6.1.2 | Declared but unused |
| `flutter_secure_storage` | ^9.2.2 | Current — good |
| `image_cropper` | ^8.0.1 | Declared but unused |
| `mobile_scanner` | ^5.2.3 | Declared but unused |
| `geolocator` | ^13.0.2 | Declared but unused |
| `fl_chart` | ^0.70.2 | Declared but unused |
| `share_plus` | ^10.1.3 | Declared but unused |
| `freezed_annotation` | ^2.4.4 | Declared but no .freezed.dart files generated |
| `json_annotation` | ^4.9.0 | Declared but no .g.dart files generated |
