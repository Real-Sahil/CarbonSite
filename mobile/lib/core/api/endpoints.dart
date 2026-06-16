import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'client.dart';

const _storage = FlutterSecureStorage();

// ---------------------------------------------------------------------------
// Model classes
// ---------------------------------------------------------------------------

class AcceptInviteResponse {
  final String sessionToken;
  final String userId;
  final String userName;
  final String orgId;
  final String orgName;
  final String role;

  const AcceptInviteResponse({
    required this.sessionToken,
    required this.userId,
    required this.userName,
    required this.orgId,
    required this.orgName,
    required this.role,
  });

  factory AcceptInviteResponse.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>? ?? {};
    final org = json['org'] as Map<String, dynamic>? ?? {};
    return AcceptInviteResponse(
      sessionToken: json['sessionToken'] as String,
      userId: user['id'] as String? ?? '',
      userName: user['name'] as String? ?? '',
      orgId: org['id'] as String? ?? '',
      orgName: org['name'] as String? ?? '',
      role: json['role'] as String? ?? 'field_worker',
    );
  }
}

class Project {
  final String id;
  final String label;
  final String startDate;
  final String endDate;
  final String status;
  final String orgId;
  final String orgName;

  const Project({
    required this.id,
    required this.label,
    required this.startDate,
    required this.endDate,
    required this.status,
    required this.orgId,
    required this.orgName,
  });

  factory Project.fromJson(Map<String, dynamic> json, {String orgName = ''}) {
    return Project(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? json['name'] as String? ?? '',
      startDate: json['startDate'] as String? ?? json['start_date'] as String? ?? '',
      endDate: json['endDate'] as String? ?? json['end_date'] as String? ?? '',
      status: json['status'] as String? ?? 'draft',
      orgId: json['organizationId'] as String? ?? json['organization_id'] as String? ?? '',
      orgName: orgName,
    );
  }

  /// Builds a Project from a /my-sites entry. The site is the unit the field
  /// worker submits against; the project name provides context in the label.
  factory Project.fromSite(Map<String, dynamic> json, {String orgName = ''}) {
    final siteName = json['name'] as String? ?? 'Site';
    final projectName = json['projectName'] as String?;
    return Project(
      id: json['id'] as String? ?? '',
      label: projectName != null && projectName.isNotEmpty
          ? '$projectName — $siteName'
          : siteName,
      startDate: json['startDate'] as String? ?? '',
      endDate: json['endDate'] as String? ?? '',
      status: json['projectStatus'] as String? ?? 'active',
      orgId: json['organizationId'] as String? ?? '',
      orgName: orgName,
    );
  }
}

class FieldSubmission {
  final String id;
  final String documentType;
  final String status;
  final String createdAt;

  /// Idempotency key echoed back by the server — used to de-duplicate
  /// against local drafts that have already synced.
  final String? clientKey;

  /// Estimated emissions for this submission once approved + calculated.
  /// Only ever this field worker's own submissions — never org-wide data.
  final double? co2eKg;

  /// GHG Protocol scope (1, 2 or 3) assigned during review, if known.
  final int? scope;

  const FieldSubmission({
    required this.id,
    required this.documentType,
    required this.status,
    required this.createdAt,
    this.clientKey,
    this.co2eKg,
    this.scope,
  });

  factory FieldSubmission.fromJson(Map<String, dynamic> json) {
    double? toDouble(Object? v) {
      if (v is num) return v.toDouble();
      if (v is String) return double.tryParse(v);
      return null;
    }

    int? toInt(Object? v) {
      if (v is int) return v;
      if (v is String) return int.tryParse(v);
      return null;
    }

    return FieldSubmission(
      id: json['id'] as String? ?? '',
      documentType: json['documentType'] as String? ??
          json['document_type'] as String? ??
          'other',
      status: json['status'] as String? ?? 'pending',
      createdAt: json['createdAt'] as String? ?? json['created_at'] as String? ?? '',
      clientKey: json['clientKey'] as String? ??
          json['client_key'] as String? ??
          json['idempotencyKey'] as String?,
      co2eKg: toDouble(json['co2eKg'] ?? json['co2e_kg']),
      scope: toInt(json['scope']),
    );
  }
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/// Accepts a field-worker invite token.
/// POST /api/auth/accept-invite
Future<AcceptInviteResponse> acceptInvite({
  required String token,
  required String name,
  String? email,
}) async {
  final client = await getClient();
  final response = await client.post(
    '/api/auth/accept-invite',
    data: {
      'token': token,
      'name': name,
      if (email != null && email.isNotEmpty) 'email': email,
    },
  );
  return AcceptInviteResponse.fromJson(
    response.data as Map<String, dynamic>,
  );
}

/// Fetches the sites this field worker is assigned to (presented as
/// "projects" in the mobile UI). Each is a place they can submit against.
/// GET /api/orgs/{orgId}/my-sites
Future<List<Project>> getProjects(String orgId) async {
  final client = await getClient();
  final orgName = await _storage.read(key: 'org_name') ?? '';
  final response = await client.get('/api/orgs/$orgId/my-sites');

  final raw = response.data;
  List<dynamic> items;
  if (raw is List) {
    items = raw;
  } else if (raw is Map && raw['data'] is List) {
    items = raw['data'] as List;
  } else {
    items = [];
  }

  return items
      .map((e) => Project.fromSite(e as Map<String, dynamic>, orgName: orgName))
      .toList();
}

/// Fetches this user's field submissions for the org.
/// GET /api/orgs/{orgId}/field-submissions?submittedByMe=true
Future<List<FieldSubmission>> getMySubmissions(String orgId) async {
  final client = await getClient();
  final response = await client.get(
    '/api/orgs/$orgId/field-submissions',
    queryParameters: {'submittedByMe': 'true'},
  );

  final raw = response.data;
  List<dynamic> items;
  if (raw is List) {
    items = raw;
  } else if (raw is Map && raw['data'] is List) {
    items = raw['data'] as List;
  } else {
    items = [];
  }

  return items
      .map((e) => FieldSubmission.fromJson(e as Map<String, dynamic>))
      .toList();
}

/// Creates a field submission (called by the background sync service).
/// POST /api/orgs/{orgId}/field-submissions
///
/// Sends `Idempotency-Key` so retries after a network drop are de-duplicated
/// server-side. Photo evidence (if any) is uploaded as multipart.
Future<FieldSubmission> createFieldSubmission({
  required String orgId,
  required String idempotencyKey,
  required String projectId,
  required String documentType,
  required Map<String, dynamic> formData,
  String? photoPath,
  double? gpsLat,
  double? gpsLng,
}) async {
  final client = await getClient();

  final fields = <String, dynamic>{
    // The mobile "project" a worker selects is a Site; the server resolves
    // the reporting period from the submission date automatically. Omitted
    // when empty (e.g. a correction resubmission) so the server can resolve
    // the period from the date alone.
    if (projectId.isNotEmpty) 'siteId': projectId,
    'documentType': documentType,
    'formData': formData,
    if (gpsLat != null) 'gpsLat': gpsLat,
    if (gpsLng != null) 'gpsLng': gpsLng,
  };

  // When a photo is attached send it as multipart so the server can receive
  // the file; formData must be JSON-encoded in that context because FormData
  // fields are always strings. For plain JSON (no photo) the Map is sent as-is.
  final Object body;
  if (photoPath != null && photoPath.isNotEmpty) {
    body = FormData.fromMap({
      ...fields,
      'formData': jsonEncode(formData),
      'photo': await MultipartFile.fromFile(photoPath),
    });
  } else {
    body = fields;
  }

  final response = await client.post(
    '/api/orgs/$orgId/field-submissions',
    data: body,
    options: Options(headers: {'Idempotency-Key': idempotencyKey}),
  );

  final raw = response.data;
  final json = raw is Map<String, dynamic>
      ? (raw['data'] is Map<String, dynamic>
          ? raw['data'] as Map<String, dynamic>
          : raw)
      : <String, dynamic>{};
  return FieldSubmission.fromJson(json);
}

// ---------------------------------------------------------------------------
// Evidence upload helpers (used by OfflineSubmissionQueue)
// ---------------------------------------------------------------------------

class EvidenceUploadResult {
  final String id;
  final String url;

  const EvidenceUploadResult({required this.id, required this.url});

  factory EvidenceUploadResult.fromJson(Map<String, dynamic> json) {
    return EvidenceUploadResult(
      id: json['id'] as String? ?? '',
      url: json['url'] as String? ?? '',
    );
  }
}

/// Uploads raw evidence bytes via a presigned R2 URL.
/// POST /api/uploads/presign → PUT to the presigned URL → returns [EvidenceUploadResult].
Future<EvidenceUploadResult> uploadEvidenceFile({
  required String orgId,
  required String filename,
  required String contentType,
  required List<int> bytes,
}) async {
  final client = await getClient();

  // Step 1: request a presigned upload URL from our backend.
  final presignRes = await client.post(
    '/api/uploads/presign',
    data: {
      'orgId': orgId,
      'filename': filename,
      'contentType': contentType,
      'size': bytes.length,
    },
  );

  final presignData = presignRes.data as Map<String, dynamic>;
  final uploadUrl = presignData['uploadUrl'] as String;
  final evidenceId = presignData['id'] as String? ?? '';
  final evidenceUrl = presignData['url'] as String? ?? '';

  // Step 2: PUT directly to R2 using the presigned URL.
  // Use a plain Dio instance without our auth interceptor — the presigned URL
  // is already scoped and adding a Bearer header would break the R2 signature.
  final presignedDio = Dio();
  await presignedDio.put(
    uploadUrl,
    data: bytes,
    options: Options(
      headers: {
        'Content-Type': contentType,
        'Content-Length': bytes.length,
      },
    ),
  );

  return EvidenceUploadResult(id: evidenceId, url: evidenceUrl);
}

// ---------------------------------------------------------------------------
// Report models + helpers
// ---------------------------------------------------------------------------

class OrgReport {
  final String id;
  final String type;
  final String status;
  final String periodLabel;
  final int snapshotVersion;
  final String createdAt;
  final bool hasPdf;
  final bool hasCsv;

  const OrgReport({
    required this.id,
    required this.type,
    required this.status,
    required this.periodLabel,
    required this.snapshotVersion,
    required this.createdAt,
    required this.hasPdf,
    required this.hasCsv,
  });

  factory OrgReport.fromJson(Map<String, dynamic> json) {
    final period = json['reportingPeriod'] as Map<String, dynamic>? ?? {};
    final snapshot = json['snapshot'] as Map<String, dynamic>? ?? {};
    return OrgReport(
      id: json['id'] as String? ?? '',
      type: json['type'] as String? ?? '',
      status: json['status'] as String? ?? 'queued',
      periodLabel: period['label'] as String? ?? '',
      snapshotVersion: snapshot['version'] as int? ?? 0,
      createdAt: json['createdAt'] as String? ?? json['created_at'] as String? ?? '',
      hasPdf: json['pdfStorageKey'] != null,
      hasCsv: json['csvStorageKey'] != null,
    );
  }

  String get typeLabel {
    const labels = {
      'inventory': 'Inventory',
      'monthly_snapshot': 'Monthly Snapshot',
      'audit_package': 'Audit Package',
      'secr': 'SECR',
      'ppn_06_21': 'PPN 06/21',
      'nhs_evergreen': 'NHS Evergreen L1',
      'breeam_evidence': 'BREEAM Evidence',
      'national_toms': 'National TOMS',
      'csrd_esrs_e1': 'CSRD ESRS E1',
      'contract_carbon': 'Contract Carbon',
    };
    return labels[type] ?? type.replaceAll('_', ' ');
  }
}

/// Fetches published reports for this org.
/// GET /api/orgs/{orgId}/reports
Future<List<OrgReport>> getOrgReports(String orgId) async {
  final client = await getClient();
  final response = await client.get('/api/orgs/$orgId/reports');
  final raw = response.data;
  List<dynamic> items;
  if (raw is List) {
    items = raw;
  } else if (raw is Map && raw['data'] is List) {
    items = raw['data'] as List;
  } else {
    items = [];
  }
  return items
      .map((e) => OrgReport.fromJson(e as Map<String, dynamic>))
      .toList();
}

/// Gets a presigned download URL for a report artefact.
/// GET /api/orgs/{orgId}/reports/{reportId}/download?artifact=pdf
Future<String> getReportDownloadUrl(String orgId, String reportId, {String artifact = 'pdf'}) async {
  final client = await getClient();
  final response = await client.get(
    '/api/orgs/$orgId/reports/$reportId/download',
    queryParameters: {'artifact': artifact},
  );
  final data = response.data as Map<String, dynamic>;
  return data['downloadUrl'] as String? ?? '';
}

class EvidenceFile {
  final String id;
  final String filename;
  final String? downloadUrl;

  const EvidenceFile({required this.id, required this.filename, this.downloadUrl});

  factory EvidenceFile.fromJson(Map<String, dynamic> json) {
    return EvidenceFile(
      id: json['id'] as String? ?? '',
      filename: json['filename'] as String? ?? '',
      downloadUrl: json['downloadUrl'] as String? ?? json['download_url'] as String?,
    );
  }
}

class FieldSubmissionDetail {
  final String id;
  final String documentType;
  final String status;
  final String createdAt;
  final String? reviewNote;
  final double? co2eKg;
  final int? scope;
  final List<EvidenceFile> evidenceFiles;

  const FieldSubmissionDetail({
    required this.id,
    required this.documentType,
    required this.status,
    required this.createdAt,
    this.reviewNote,
    this.co2eKg,
    this.scope,
    this.evidenceFiles = const [],
  });

  factory FieldSubmissionDetail.fromJson(Map<String, dynamic> json) {
    double? toDouble(Object? v) {
      if (v is num) return v.toDouble();
      if (v is String) return double.tryParse(v);
      return null;
    }
    int? toInt(Object? v) {
      if (v is int) return v;
      if (v is String) return int.tryParse(v);
      return null;
    }
    final rawFiles = (json['evidenceFiles'] ?? json['evidence_files']) as List<dynamic>? ?? [];
    return FieldSubmissionDetail(
      id: json['id'] as String? ?? '',
      documentType: json['documentType'] as String? ?? json['document_type'] as String? ?? 'other',
      status: json['status'] as String? ?? 'pending_review',
      createdAt: json['createdAt'] as String? ?? json['created_at'] as String? ?? '',
      reviewNote: json['reviewNote'] as String? ?? json['review_note'] as String?,
      co2eKg: toDouble(json['co2eKg'] ?? json['co2e_kg']),
      scope: toInt(json['scope']),
      evidenceFiles: rawFiles.map((e) => EvidenceFile.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}

Future<FieldSubmissionDetail> getSubmissionDetail(String orgId, String submissionId) async {
  final client = await getClient();
  final response = await client.get('/api/orgs/$orgId/field-submissions/$submissionId');
  final raw = response.data;
  final json = raw is Map<String, dynamic>
      ? (raw['data'] is Map<String, dynamic> ? raw['data'] as Map<String, dynamic> : raw)
      : <String, dynamic>{};
  return FieldSubmissionDetail.fromJson(json);
}

/// Submits a field submission with optional pre-uploaded evidence IDs.
/// POST /api/orgs/{orgId}/field-submissions
///
/// Used by [OfflineSubmissionQueue] which handles evidence upload separately.
Future<FieldSubmission> submitFieldSubmission({
  required String orgId,
  required String reportingPeriodId,
  required String documentType,
  required Map<String, dynamic> formData,
  required String idempotencyKey,
  List<String> evidenceIds = const [],
  String? pickupPostcode,
  String? deliveryPostcode,
  double? gpsLat,
  double? gpsLng,
  Map<String, dynamic>? ocrExtractedData,
}) async {
  final client = await getClient();

  final body = <String, dynamic>{
    'reportingPeriodId': reportingPeriodId,
    'documentType': documentType,
    'formData': formData,
    if (evidenceIds.isNotEmpty) 'evidenceIds': evidenceIds,
    if (pickupPostcode != null) 'pickupPostcode': pickupPostcode,
    if (deliveryPostcode != null) 'deliveryPostcode': deliveryPostcode,
    if (gpsLat != null) 'gpsLat': gpsLat,
    if (gpsLng != null) 'gpsLng': gpsLng,
    if (ocrExtractedData != null) 'ocrExtractedData': ocrExtractedData,
  };

  final response = await client.post(
    '/api/orgs/$orgId/field-submissions',
    data: body,
    options: Options(headers: {'Idempotency-Key': idempotencyKey}),
  );

  final raw = response.data;
  final json = raw is Map<String, dynamic>
      ? (raw['data'] is Map<String, dynamic>
          ? raw['data'] as Map<String, dynamic>
          : raw)
      : <String, dynamic>{};
  return FieldSubmission.fromJson(json);
}
