import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../api/endpoints.dart';

class QueuedSubmission {
  final String id;
  final String orgId;
  final String reportingPeriodId;
  final String documentType;
  final Map<String, dynamic> formData;
  final String idempotencyKey;
  final String createdAt;
  final String? evidencePath;
  final String? evidenceFilename;
  final String? evidenceContentType;
  final String? pickupPostcode;
  final String? deliveryPostcode;
  final double? gpsLat;
  final double? gpsLng;

  const QueuedSubmission({
    required this.id,
    required this.orgId,
    required this.reportingPeriodId,
    required this.documentType,
    required this.formData,
    required this.idempotencyKey,
    required this.createdAt,
    this.evidencePath,
    this.evidenceFilename,
    this.evidenceContentType,
    this.pickupPostcode,
    this.deliveryPostcode,
    this.gpsLat,
    this.gpsLng,
  });

  factory QueuedSubmission.fromJson(Map<String, dynamic> json) {
    return QueuedSubmission(
      id: json['id'] as String,
      orgId: json['orgId'] as String,
      reportingPeriodId: json['reportingPeriodId'] as String,
      documentType: json['documentType'] as String,
      formData: Map<String, dynamic>.from(json['formData'] as Map),
      idempotencyKey: json['idempotencyKey'] as String,
      createdAt: json['createdAt'] as String,
      evidencePath: json['evidencePath'] as String?,
      evidenceFilename: json['evidenceFilename'] as String?,
      evidenceContentType: json['evidenceContentType'] as String?,
      pickupPostcode: json['pickupPostcode'] as String?,
      deliveryPostcode: json['deliveryPostcode'] as String?,
      gpsLat: (json['gpsLat'] as num?)?.toDouble(),
      gpsLng: (json['gpsLng'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'orgId': orgId,
      'reportingPeriodId': reportingPeriodId,
      'documentType': documentType,
      'formData': formData,
      'idempotencyKey': idempotencyKey,
      'createdAt': createdAt,
      if (evidencePath != null) 'evidencePath': evidencePath,
      if (evidenceFilename != null) 'evidenceFilename': evidenceFilename,
      if (evidenceContentType != null)
        'evidenceContentType': evidenceContentType,
      if (pickupPostcode != null) 'pickupPostcode': pickupPostcode,
      if (deliveryPostcode != null) 'deliveryPostcode': deliveryPostcode,
      if (gpsLat != null) 'gpsLat': gpsLat,
      if (gpsLng != null) 'gpsLng': gpsLng,
    };
  }
}

class QueueSyncResult {
  final int total;
  final int synced;
  final int failed;

  const QueueSyncResult({
    required this.total,
    required this.synced,
    required this.failed,
  });
}

class OfflineSubmissionQueue {
  static bool _syncing = false;

  static Future<QueuedSubmission> createDraft({
    required String orgId,
    required String reportingPeriodId,
    required String documentType,
    required Map<String, dynamic> formData,
    String? sourceEvidencePath,
    String? evidenceFilename,
    String? evidenceContentType,
    String? pickupPostcode,
    String? deliveryPostcode,
    double? gpsLat,
    double? gpsLng,
  }) async {
    final now = DateTime.now().toUtc();
    final id = '$reportingPeriodId-${now.microsecondsSinceEpoch}';
    String? storedEvidencePath;

    if (sourceEvidencePath != null) {
      final directory = await _evidenceDirectory();
      final extension = p.extension(sourceEvidencePath);
      final target = File(p.join(directory.path, '$id$extension'));
      await File(sourceEvidencePath).copy(target.path);
      storedEvidencePath = target.path;
    }

    return QueuedSubmission(
      id: id,
      orgId: orgId,
      reportingPeriodId: reportingPeriodId,
      documentType: documentType,
      formData: formData,
      idempotencyKey: id,
      createdAt: now.toIso8601String(),
      evidencePath: storedEvidencePath,
      evidenceFilename: evidenceFilename,
      evidenceContentType: evidenceContentType,
      pickupPostcode: pickupPostcode,
      deliveryPostcode: deliveryPostcode,
      gpsLat: gpsLat,
      gpsLng: gpsLng,
    );
  }

  static Future<void> enqueue(QueuedSubmission submission) async {
    final submissions = await pending();
    if (!submissions.any((item) => item.id == submission.id)) {
      submissions.add(submission);
      await _write(submissions);
    }
  }

  static Future<List<QueuedSubmission>> pending() async {
    final file = await _queueFile();
    if (!await file.exists()) return [];
    final raw = await file.readAsString();
    if (raw.trim().isEmpty) return [];
    final decoded = jsonDecode(raw) as List<dynamic>;
    return decoded
        .map((item) => QueuedSubmission.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  static Future<QueueSyncResult> syncPending() async {
    if (_syncing) return const QueueSyncResult(total: 0, synced: 0, failed: 0);
    _syncing = true;
    try {
      final submissions = await pending();
      var synced = 0;
      var failed = 0;

      for (final submission in submissions) {
        try {
          await submitQueuedSubmission(submission);
          await remove(submission.id);
          synced += 1;
        } catch (_) {
          failed += 1;
        }
      }

      return QueueSyncResult(
        total: submissions.length,
        synced: synced,
        failed: failed,
      );
    } finally {
      _syncing = false;
    }
  }

  static Future<FieldSubmission> submitQueuedSubmission(
    QueuedSubmission submission,
  ) async {
    final evidenceIds = <String>[];
    final evidencePath = submission.evidencePath;

    if (evidencePath != null && evidencePath.isNotEmpty) {
      final file = File(evidencePath);
      if (await file.exists()) {
        final upload = await uploadEvidenceFile(
          orgId: submission.orgId,
          filename: submission.evidenceFilename ?? p.basename(evidencePath),
          contentType: submission.evidenceContentType ?? 'image/jpeg',
          bytes: await file.readAsBytes(),
        );
        if (upload.id.isNotEmpty) evidenceIds.add(upload.id);
      }
    }

    return submitFieldSubmission(
      orgId: submission.orgId,
      reportingPeriodId: submission.reportingPeriodId,
      documentType: submission.documentType,
      formData: submission.formData,
      evidenceIds: evidenceIds,
      idempotencyKey: submission.idempotencyKey,
      pickupPostcode: submission.pickupPostcode,
      deliveryPostcode: submission.deliveryPostcode,
      gpsLat: submission.gpsLat,
      gpsLng: submission.gpsLng,
    );
  }

  static Future<void> remove(String id) async {
    final submissions = await pending();
    final removed = submissions.where((item) => item.id == id).toList();
    await _write(submissions.where((item) => item.id != id).toList());
    for (final submission in removed) {
      final evidencePath = submission.evidencePath;
      if (evidencePath == null) continue;
      final file = File(evidencePath);
      if (await file.exists()) await file.delete();
    }
  }

  static Future<File> _queueFile() async {
    final directory = await getApplicationDocumentsDirectory();
    return File(p.join(directory.path, 'offline_submissions.json'));
  }

  static Future<Directory> _evidenceDirectory() async {
    final directory = await getApplicationDocumentsDirectory();
    final evidenceDirectory =
        Directory(p.join(directory.path, 'offline_evidence'));
    if (!await evidenceDirectory.exists()) {
      await evidenceDirectory.create(recursive: true);
    }
    return evidenceDirectory;
  }

  static Future<void> _write(List<QueuedSubmission> submissions) async {
    final file = await _queueFile();
    await file.writeAsString(
      jsonEncode(submissions.map((item) => item.toJson()).toList()),
      flush: true,
    );
  }
}
