import 'package:crypto/crypto.dart';
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

// ---------------------------------------------------------------------------
// Evidence upload helpers (used by SyncService)
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
/// POST /api/orgs/{orgId}/evidence (creates the EvidenceFile row and returns
/// a presigned upload URL) → PUT to that URL → returns [EvidenceUploadResult].
Future<EvidenceUploadResult> uploadEvidenceFile({
  required String orgId,
  required String filename,
  required String contentType,
  required List<int> bytes,
}) async {
  final client = await getClient();
  final checksum = sha256.convert(bytes).toString();

  // Step 1: register the evidence file and request a presigned upload URL.
  final presignRes = await client.post(
    '/api/orgs/$orgId/evidence',
    data: {
      'filename': filename,
      'contentType': contentType,
      'byteSize': bytes.length,
      'checksum': checksum,
    },
  );

  final presignData = presignRes.data as Map<String, dynamic>;
  final evidence = presignData['evidence'] as Map<String, dynamic>;
  var uploadUrl = presignData['uploadUrl'] as String;
  final evidenceId = evidence['id'] as String? ?? '';

  // Defensive: some storage drivers can return a server-relative upload path.
  // A bare path is not a valid URL for the plain Dio instance below.
  if (uploadUrl.startsWith('/')) {
    uploadUrl = client.options.baseUrl + uploadUrl;
  }

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

  return EvidenceUploadResult(id: evidenceId, url: uploadUrl);
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

  /// Site the submission was made against — used to start a correction
  /// capture for the same site.
  final String? siteId;
  final List<EvidenceFile> evidenceFiles;

  const FieldSubmissionDetail({
    required this.id,
    required this.documentType,
    required this.status,
    required this.createdAt,
    this.reviewNote,
    this.co2eKg,
    this.scope,
    this.siteId,
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
      siteId: json['siteId'] as String? ?? json['site_id'] as String?,
      evidenceFiles: rawFiles.map((e) => EvidenceFile.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}

/// Resubmits a corrected version of a rejected / needs-info submission.
/// POST /api/orgs/{orgId}/field-submissions/{submissionId}/resubmit
///
/// The server links the new submission to the original via resubmittedFromId
/// so reviewers see the correction chain.
Future<FieldSubmission> resubmitFieldSubmission({
  required String orgId,
  required String originalSubmissionId,
  required String documentType,
  required Map<String, dynamic> formData,
  String? idempotencyKey,
  Map<String, dynamic>? ocrExtractedData,
  List<String> evidenceFileIds = const [],
  double? gpsLat,
  double? gpsLng,
}) async {
  final client = await getClient();
  final response = await client.post(
    '/api/orgs/$orgId/field-submissions/$originalSubmissionId/resubmit',
    data: {
      'documentType': documentType,
      'formData': formData,
      if (idempotencyKey != null) 'idempotencyKey': idempotencyKey,
      if (ocrExtractedData != null) 'ocrExtractedData': ocrExtractedData,
      if (evidenceFileIds.isNotEmpty) 'evidenceFileIds': evidenceFileIds,
      if (gpsLat != null) 'gpsLat': gpsLat,
      if (gpsLng != null) 'gpsLng': gpsLng,
    },
  );
  final raw = response.data;
  final json = raw is Map<String, dynamic>
      ? (raw['data'] is Map<String, dynamic> ? raw['data'] as Map<String, dynamic> : raw)
      : <String, dynamic>{};
  return FieldSubmission.fromJson(json);
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
/// Used by [SyncService] which handles evidence upload separately.
Future<FieldSubmission> submitFieldSubmission({
  required String orgId,
  // The mobile "project" a worker selects is a Site id, not a reporting
  // period — the server resolves the reporting period from the submission
  // date. Passing this as reportingPeriodId would 404 on every submission.
  required String siteId,
  required String documentType,
  required Map<String, dynamic> formData,
  required String idempotencyKey,
  List<String> evidenceIds = const [],
  double? gpsLat,
  double? gpsLng,
  Map<String, dynamic>? ocrExtractedData,
  // When the draft was captured on-device — the server uses it to book the
  // submission into the correct reporting period even if sync happens later.
  DateTime? deviceSubmittedAt,
}) async {
  final client = await getClient();

  final body = <String, dynamic>{
    if (siteId.isNotEmpty) 'siteId': siteId,
    'documentType': documentType,
    'formData': formData,
    // Belt and braces: the key travels in the body (what the server's Zod
    // schema reads) AND as a header (accepted as a fallback server-side).
    'idempotencyKey': idempotencyKey,
    if (evidenceIds.isNotEmpty) 'evidenceIds': evidenceIds,
    if (gpsLat != null) 'gpsLat': gpsLat,
    if (gpsLng != null) 'gpsLng': gpsLng,
    if (ocrExtractedData != null) 'ocrExtractedData': ocrExtractedData,
    if (deviceSubmittedAt != null)
      'deviceSubmittedAt': deviceSubmittedAt.toUtc().toIso8601String(),
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
