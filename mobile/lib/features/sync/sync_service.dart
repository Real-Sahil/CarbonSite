// Background sync service — drains the local draft queue to the server.
//
// Lifecycle per draft: pending -> syncing -> submitted | failed
//   - transient errors (network / 5xx / 408 / 429): exponential backoff,
//     draft stays pending and is retried automatically (max 5 attempts).
//   - permanent errors (other 4xx): marked failed, manual retry only.
//   - 409 Conflict means the server already has this idempotency key,
//     i.e. a previous attempt succeeded after the response was lost —
//     treated as success.
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path/path.dart' as p;

import '../../core/api/endpoints.dart';
import '../../core/storage/app_database.dart';

class SyncService {
  SyncService({required AppDatabase db}) : _db = db;

  final AppDatabase _db;

  static const int _maxAttempts = 5;
  static const Duration _baseDelay = Duration(seconds: 5);
  static const Duration _maxDelay = Duration(minutes: 5);
  static const _storage = FlutterSecureStorage();

  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  Timer? _retryTimer;
  bool _draining = false;

  /// Begin listening for connectivity and kick off an initial drain.
  void start() {
    _connectivitySub ??= Connectivity().onConnectivityChanged.listen((results) {
      final online = results.any((r) => r != ConnectivityResult.none);
      if (online) {
        // Network came back — drain immediately, drop any backoff timer.
        _retryTimer?.cancel();
        syncNow();
      }
    });
    // Recover drafts stranded in `syncing` by a mid-upload app kill — they
    // are invisible to draftsToSync() and would never be retried.
    _db.resetStuckSyncingDrafts().whenComplete(syncNow);
  }

  void dispose() {
    _connectivitySub?.cancel();
    _connectivitySub = null;
    _retryTimer?.cancel();
    _retryTimer = null;
  }

  /// Drain all pending drafts. Safe to call repeatedly — re-entrant calls
  /// while a drain is in flight are no-ops.
  Future<void> syncNow() async {
    if (_draining) return;
    _draining = true;
    var needsRetry = false;
    try {
      final connectivity = await Connectivity().checkConnectivity();
      final online = connectivity.any((r) => r != ConnectivityResult.none);
      if (!online) return; // listener will fire when we're back online

      final orgId = await _storage.read(key: 'org_id');
      if (orgId == null || orgId.isEmpty) return;

      final drafts = await _db.draftsToSync();
      for (final draft in drafts) {
        final retry = await _syncDraft(orgId, draft);
        if (retry) needsRetry = true;
      }
    } finally {
      _draining = false;
    }
    if (needsRetry) {
      await _scheduleRetry();
    }
  }

  /// Reset a failed draft and try again immediately (user-initiated).
  Future<void> retryDraft(String draftId) async {
    await _db.resetDraftForRetry(draftId);
    await syncNow();
  }

  /// Returns true when the draft should be retried later (transient failure).
  Future<bool> _syncDraft(String orgId, DraftSubmission draft) async {
    await _db.updateDraftStatus(draft.id, DraftStatus.syncing);
    try {
      Map<String, dynamic> formData;
      try {
        formData = jsonDecode(draft.formData) as Map<String, dynamic>;
      } catch (_) {
        formData = {'raw': draft.formData};
      }

      // Corrections carry the original submission id — they go through the
      // /resubmit endpoint so the server links the correction chain and
      // inherits the original's site and reporting period.
      final resubmittedFromId = formData.remove('resubmittedFromId') as String?;

      // Upload photo evidence separately via presigned URL, then submit JSON.
      // This is an evidence-capture app: an upload failure must NOT silently
      // drop the photo. Transient failures (network, 5xx, 429, auth) retry
      // the whole draft later; only unrecoverable file rejections (bad type /
      // too large) fall through to a photo-less submission.
      final evidenceIds = <String>[];
      // Set only when the photo is permanently dropped (see below) — recorded
      // on the draft so the field worker sees it, instead of the submission
      // silently landing with no evidence and no explanation.
      String? photoDropReason;
      final photoPath = draft.photoLocalPath;
      if (photoPath != null && photoPath.isNotEmpty) {
        final file = File(photoPath);
        if (await file.exists()) {
          final bytes = await file.readAsBytes();
          final filename = p.basename(photoPath);
          final ext = p.extension(filename).toLowerCase();
          final contentType = ext == '.png' ? 'image/png' : 'image/jpeg';
          try {
            final result = await uploadEvidenceFile(
              orgId: orgId,
              filename: filename,
              contentType: contentType,
              bytes: bytes,
            );
            if (result.id.isNotEmpty) evidenceIds.add(result.id);
          } on DioException catch (e) {
            final status = e.response?.statusCode;
            final unrecoverableFile = status == 400 ||
                status == 413 ||
                status == 415 ||
                status == 422;
            // Transient — retry the whole draft later instead of losing
            // the photo.
            if (!unrecoverableFile) rethrow;
            // The server permanently rejects this file — submit the record
            // without it rather than blocking the data forever, but record
            // why so the field worker isn't left thinking the photo made it.
            photoDropReason =
                'Photo could not be attached (${_describeDioError(e)}) — '
                'submitted without evidence.';
          }
        }
      }

      if (resubmittedFromId != null && resubmittedFromId.isNotEmpty) {
        await resubmitFieldSubmission(
          orgId: orgId,
          originalSubmissionId: resubmittedFromId,
          documentType: draft.documentType,
          formData: formData,
          idempotencyKey: draft.idempotencyKey,
          evidenceFileIds: evidenceIds,
          gpsLat: draft.gpsLat,
          gpsLng: draft.gpsLng,
        );
      } else {
        await submitFieldSubmission(
          orgId: orgId,
          siteId: draft.projectId,
          documentType: draft.documentType,
          formData: formData,
          idempotencyKey: draft.idempotencyKey,
          evidenceIds: evidenceIds,
          gpsLat: draft.gpsLat,
          gpsLng: draft.gpsLng,
          // Book the submission into the period covering capture time, not
          // whenever connectivity happened to return.
          deviceSubmittedAt: draft.createdAt,
        );
      }

      await _db.updateDraftStatus(
        draft.id,
        DraftStatus.submitted,
        syncError: photoDropReason,
      );
      // Keep the local photo after sync — provides fallback if presigned URL fails.
      // Device storage is typically not space-constrained; instant offline access
      // is more valuable than saving a few MB.
      return false;
    } on DioException catch (e) {
      final statusCode = e.response?.statusCode;

      // Duplicate idempotency key: a previous attempt already landed.
      if (statusCode == 409) {
        await _db.updateDraftStatus(draft.id, DraftStatus.submitted);
        return false;
      }

      // 401 is an auth problem, not a data problem — keep the draft pending
      // so it syncs once the session recovers instead of marking good
      // offline data as failed.
      final permanent = statusCode != null &&
          statusCode >= 400 &&
          statusCode < 500 &&
          statusCode != 401 &&
          statusCode != 408 &&
          statusCode != 429;
      return _recordFailure(
        draft,
        statusCode == 401
            ? 'Session expired — sign in again to sync'
            : _describeDioError(e),
        permanent: permanent,
      );
    } catch (e) {
      return _recordFailure(draft, e.toString(), permanent: false);
    }
  }

  Future<bool> _recordFailure(
    DraftSubmission draft,
    String error, {
    required bool permanent,
  }) async {
    final attempts = draft.attemptCount + 1;
    if (permanent || attempts >= _maxAttempts) {
      await _db.markDraftFailed(draft.id, attemptCount: attempts, error: error);
      return false;
    }
    await _db.markDraftRetry(draft.id, attemptCount: attempts, error: error);
    return true;
  }

  /// Exponential backoff: 5s, 10s, 20s, 40s ... capped at 5 minutes.
  Future<void> _scheduleRetry() async {
    final drafts = await _db.draftsToSync();
    if (drafts.isEmpty) return;
    final attempts =
        drafts.map((d) => d.attemptCount).reduce(math.max).clamp(0, 16);
    var delay = _baseDelay * math.pow(2, attempts).toInt();
    if (delay > _maxDelay) delay = _maxDelay;
    _retryTimer?.cancel();
    _retryTimer = Timer(delay, syncNow);
  }

  String _describeDioError(DioException e) {
    final statusCode = e.response?.statusCode;
    if (statusCode != null) {
      final data = e.response?.data;
      if (data is Map && data['message'] is String) {
        return 'Server error ($statusCode): ${data['message']}';
      }
      return 'Server error ($statusCode)';
    }
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return 'Connection timed out';
      case DioExceptionType.connectionError:
        return 'No internet connection';
      default:
        return 'Network error';
    }
  }
}

// -----------------------------------------------------------------------------
// Riverpod providers
// -----------------------------------------------------------------------------

/// App-wide sync service — created and started once at app boot.
final syncServiceProvider = Provider<SyncService>((ref) {
  final service = SyncService(db: ref.watch(appDatabaseProvider));
  service.start();
  ref.onDispose(service.dispose);
  return service;
});

/// Live online/offline flag for UI banners. `null` while undetermined.
final isOnlineProvider = StreamProvider<bool>((ref) async* {
  final connectivity = Connectivity();
  final initial = await connectivity.checkConnectivity();
  yield initial.any((r) => r != ConnectivityResult.none);
  yield* connectivity.onConnectivityChanged
      .map((results) => results.any((r) => r != ConnectivityResult.none));
});
