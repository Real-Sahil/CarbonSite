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
    'reportingPeriodId': projectId,
    'documentType': documentType,
    'formData': jsonEncode(formData),
    if (gpsLat != null) 'gpsLat': gpsLat.toString(),
    if (gpsLng != null) 'gpsLng': gpsLng.toString(),
  };

  // Dio sets the multipart content type (with boundary) automatically
  // when the body is FormData.
  final Object body;
  if (photoPath != null && photoPath.isNotEmpty) {
    body = FormData.fromMap({
      ...fields,
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
