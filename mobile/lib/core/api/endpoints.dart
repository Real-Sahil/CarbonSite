import 'dart:typed_data';

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

  factory Project.fromJson(Map<String, dynamic> json, {String orgName = ''}) {
    return Project(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? json['name'] as String? ?? '',
      startDate:
          json['startDate'] as String? ?? json['start_date'] as String? ?? '',
      endDate: json['endDate'] as String? ?? json['end_date'] as String? ?? '',
      status: json['status'] as String? ?? 'draft',
      orgId: json['organizationId'] as String? ??
          json['organization_id'] as String? ??
          '',
      orgName: orgName,
    );
  }
}

class FieldSubmission {
  final String id;
  final String documentType;
  final String status;
  final String createdAt;

  const FieldSubmission({
    required this.id,
    required this.documentType,
    required this.status,
    required this.createdAt,
  });

  factory FieldSubmission.fromJson(Map<String, dynamic> json) {
    return FieldSubmission(
      id: json['id'] as String? ?? '',
      documentType: json['documentType'] as String? ??
          json['document_type'] as String? ??
          'other',
      status: json['status'] as String? ?? 'pending',
      createdAt:
          json['createdAt'] as String? ?? json['created_at'] as String? ?? '',
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

/// Fetches the org's reporting periods (presented as "projects" to field workers).
/// GET /api/orgs/{orgId}/reporting-periods
Future<List<Project>> getProjects(String orgId) async {
  final client = await getClient();
  final orgName = await _storage.read(key: 'org_name') ?? '';
  final response = await client.get('/api/orgs/$orgId/reporting-periods');

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
      .map((e) => Project.fromJson(e as Map<String, dynamic>, orgName: orgName))
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

class EvidenceUpload {
  final String id;
  final String filename;

  const EvidenceUpload({
    required this.id,
    required this.filename,
  });

  factory EvidenceUpload.fromJson(Map<String, dynamic> json) {
    final evidence = json['evidence'] as Map<String, dynamic>? ?? {};
    return EvidenceUpload(
      id: evidence['id'] as String? ?? '',
      filename: evidence['filename'] as String? ?? '',
    );
  }
}

Future<FieldSubmission> submitFieldSubmission({
  required String orgId,
  required String reportingPeriodId,
  required String documentType,
  required Map<String, dynamic> formData,
  String? idempotencyKey,
  List<String> evidenceIds = const [],
  Map<String, dynamic>? ocrExtractedData,
  String? emissionCategoryId,
  String? facilityId,
  double? gpsLat,
  double? gpsLng,
  String? pickupPostcode,
  String? deliveryPostcode,
}) async {
  final client = await getClient();
  final response = await client.post(
    '/api/orgs/$orgId/field-submissions',
    data: {
      'reportingPeriodId': reportingPeriodId,
      'documentType': documentType,
      'formData': formData,
      if (ocrExtractedData != null) 'ocrExtractedData': ocrExtractedData,
      if (emissionCategoryId != null && emissionCategoryId.isNotEmpty)
        'emissionCategoryId': emissionCategoryId,
      if (facilityId != null && facilityId.isNotEmpty) 'facilityId': facilityId,
      if (gpsLat != null) 'gpsLat': gpsLat,
      if (gpsLng != null) 'gpsLng': gpsLng,
      if (pickupPostcode != null && pickupPostcode.isNotEmpty)
        'pickupPostcode': pickupPostcode,
      if (deliveryPostcode != null && deliveryPostcode.isNotEmpty)
        'deliveryPostcode': deliveryPostcode,
      if (evidenceIds.isNotEmpty) 'evidenceIds': evidenceIds,
      'deviceSubmittedAt': DateTime.now().toUtc().toIso8601String(),
      'idempotencyKey': idempotencyKey ??
          '$reportingPeriodId-${DateTime.now().microsecondsSinceEpoch}',
    },
  );
  return FieldSubmission.fromJson(response.data as Map<String, dynamic>);
}

Future<EvidenceUpload> uploadEvidenceFile({
  required String orgId,
  required String filename,
  required String contentType,
  required Uint8List bytes,
}) async {
  final client = await getClient();
  final checksum = sha256.convert(bytes).toString();
  final presignResponse = await client.post(
    '/api/orgs/$orgId/evidence',
    data: {
      'filename': filename,
      'contentType': contentType,
      'byteSize': bytes.length,
      'checksum': checksum,
    },
  );
  final upload = EvidenceUpload.fromJson(
    presignResponse.data as Map<String, dynamic>,
  );
  final uploadUrl =
      (presignResponse.data as Map<String, dynamic>)['uploadUrl'] as String;

  final storageClient = Dio();
  final targetUrl = uploadUrl.startsWith('/')
      ? '${client.options.baseUrl}$uploadUrl'
      : uploadUrl;
  await storageClient.put(
    targetUrl,
    data: bytes,
    options: Options(
      headers: {
        'Content-Type': contentType,
        'Content-Length': bytes.length,
      },
    ),
  );

  return upload;
}
