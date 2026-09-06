// Offline-first draft submission store (drift / SQLite).
//
// Submissions are ALWAYS written here first, then drained by
// `features/sync/sync_service.dart` when connectivity returns.
//
// NOTE: drift uses code generation. After changing tables, run:
//
//   cd mobile && dart run build_runner build --delete-conflicting-outputs
//
// to (re)generate `app_database.g.dart` (row class `DraftSubmission`,
// companion `DraftSubmissionsCompanion`, typed query API).
import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

part 'app_database.g.dart';

/// Lifecycle of a locally captured submission.
/// pending -> syncing -> submitted | failed
enum DraftStatus {
  pending('pending'),
  syncing('syncing'),
  submitted('submitted'),
  failed('failed');

  const DraftStatus(this.dbValue);
  final String dbValue;

  static DraftStatus fromDb(String value) => DraftStatus.values.firstWhere(
        (s) => s.dbValue == value,
        orElse: () => DraftStatus.pending,
      );
}

/// Draft field submissions captured on-device.
@DataClassName('DraftSubmission')
class DraftSubmissions extends Table {
  /// Client-generated UUID — primary key and stable across retries.
  TextColumn get id => text()();

  /// Site the submission belongs to (shown as a "project" in the UI).
  /// Sent to the server as siteId; the server resolves the reporting period.
  TextColumn get projectId => text()();

  /// waste_ticket | delivery_note | fuel_receipt | other
  TextColumn get documentType => text()();

  /// JSON-encoded form fields (weight, ewcCode, date, vehicleReg, ...).
  TextColumn get formData => text()();

  /// Absolute path of the evidence photo copied into app documents dir.
  TextColumn get photoLocalPath => text().nullable()();

  RealColumn get gpsLat => real().nullable()();
  RealColumn get gpsLng => real().nullable()();

  /// pending | syncing | submitted | failed — see [DraftStatus].
  TextColumn get status =>
      text().withDefault(const Constant('pending'))();

  /// Idempotency key sent as a header on every upload attempt so the
  /// server can de-duplicate retries. Generated once at draft creation.
  TextColumn get idempotencyKey => text()();

  /// Number of failed sync attempts so far (drives exponential backoff).
  IntColumn get attemptCount => integer().withDefault(const Constant(0))();

  /// Human-readable reason for the most recent sync failure.
  TextColumn get syncError => text().nullable()();

  DateTimeColumn get createdAt =>
      dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

@DriftDatabase(tables: [DraftSubmissions])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  /// In-memory database for widget/unit tests.
  AppDatabase.forTesting(super.executor);

  @override
  int get schemaVersion => 1;

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  /// All drafts, newest first — drives the submissions list UI.
  Stream<List<DraftSubmission>> watchAllDrafts() {
    return (select(draftSubmissions)
          ..orderBy([(t) => OrderingTerm.desc(t.createdAt)]))
        .watch();
  }

  /// Drafts that the sync service should attempt, oldest first (FIFO).
  Future<List<DraftSubmission>> draftsToSync() {
    return (select(draftSubmissions)
          ..where((t) => t.status.equals(DraftStatus.pending.dbValue))
          ..orderBy([(t) => OrderingTerm.asc(t.createdAt)]))
        .get();
  }

  Future<void> insertDraft(DraftSubmissionsCompanion entry) {
    return into(draftSubmissions).insert(entry);
  }

  Future<void> updateDraftStatus(
    String id,
    DraftStatus status, {
    String? syncError,
  }) {
    return (update(draftSubmissions)..where((t) => t.id.equals(id))).write(
      DraftSubmissionsCompanion(
        status: Value(status.dbValue),
        syncError: Value(syncError),
      ),
    );
  }

  /// Transient failure: keep the draft pending so the next drain retries it.
  Future<void> markDraftRetry(
    String id, {
    required int attemptCount,
    required String error,
  }) {
    return (update(draftSubmissions)..where((t) => t.id.equals(id))).write(
      DraftSubmissionsCompanion(
        status: Value(DraftStatus.pending.dbValue),
        attemptCount: Value(attemptCount),
        syncError: Value(error),
      ),
    );
  }

  /// Permanent failure (4xx or retries exhausted) — needs manual retry.
  Future<void> markDraftFailed(
    String id, {
    required int attemptCount,
    required String error,
  }) {
    return (update(draftSubmissions)..where((t) => t.id.equals(id))).write(
      DraftSubmissionsCompanion(
        status: Value(DraftStatus.failed.dbValue),
        attemptCount: Value(attemptCount),
        syncError: Value(error),
      ),
    );
  }

  /// Recover drafts stranded in `syncing` by a mid-upload app kill — they are
  /// invisible to [draftsToSync] (which selects only `pending`) and would
  /// otherwise show a perpetual "Syncing" chip. Called on sync-service start.
  Future<void> resetStuckSyncingDrafts() {
    return (update(draftSubmissions)
          ..where((t) => t.status.equals(DraftStatus.syncing.dbValue)))
        .write(
      const DraftSubmissionsCompanion(status: Value('pending')),
    );
  }

  /// User-initiated retry of a failed draft: reset to pending.
  Future<void> resetDraftForRetry(String id) {
    return (update(draftSubmissions)..where((t) => t.id.equals(id))).write(
      const DraftSubmissionsCompanion(
        status: Value('pending'),
        attemptCount: Value(0),
        syncError: Value(null),
      ),
    );
  }

  Future<void> deleteDraft(String id) {
    return (delete(draftSubmissions)..where((t) => t.id.equals(id))).go();
  }
}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dir = await getApplicationDocumentsDirectory();
    final file = File(p.join(dir.path, 'metricora.sqlite'));
    return NativeDatabase.createInBackground(file);
  });
}

// -----------------------------------------------------------------------------
// Riverpod providers
// -----------------------------------------------------------------------------

final appDatabaseProvider = Provider<AppDatabase>((ref) {
  final db = AppDatabase();
  ref.onDispose(db.close);
  return db;
});

/// Live stream of local drafts for the submissions list and dashboard.
final localDraftsProvider = StreamProvider<List<DraftSubmission>>((ref) {
  return ref.watch(appDatabaseProvider).watchAllDrafts();
});
