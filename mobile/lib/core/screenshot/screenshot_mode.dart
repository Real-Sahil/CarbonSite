import '../../core/api/endpoints.dart';

/// True when the app was compiled with `--dart-define=SCREENSHOT_MODE=true`.
/// All screens check this flag to skip auth and use local mock data instead
/// of real API calls, so Appetize sessions start directly on the dashboard.
const bool kScreenshotMode = bool.fromEnvironment('SCREENSHOT_MODE');

/// Static mock data seeded for screenshot builds.
/// Worker: Alex Rivera, Buildco Ltd — realistic mix of document types,
/// statuses, and co2e values so all charts render non-empty.
abstract final class ScreenshotMockData {
  static const String userName = 'Alex Rivera';
  static const String orgName = 'Buildco Ltd';

  static final List<FieldSubmission> submissions = [
    // Approved with co2e so the donut and bar chart render real data.
    FieldSubmission(
      id: 's1', documentType: 'waste_ticket', status: 'approved',
      createdAt: '2026-09-08T09:14:00Z', co2eKg: 84.2, scope: 3, evidenceCount: 1,
    ),
    FieldSubmission(
      id: 's2', documentType: 'fuel_receipt', status: 'approved',
      createdAt: '2026-09-05T07:45:00Z', co2eKg: 128.7, scope: 1, evidenceCount: 1,
    ),
    FieldSubmission(
      id: 's3', documentType: 'delivery_note', status: 'approved',
      createdAt: '2026-08-29T13:22:00Z', co2eKg: 37.4, scope: 3, evidenceCount: 1,
    ),
    FieldSubmission(
      id: 's4', documentType: 'waste_ticket', status: 'approved',
      createdAt: '2026-08-20T10:05:00Z', co2eKg: 62.1, scope: 3, evidenceCount: 1,
    ),
    FieldSubmission(
      id: 's5', documentType: 'fuel_receipt', status: 'approved',
      createdAt: '2026-07-31T08:30:00Z', co2eKg: 155.9, scope: 1, evidenceCount: 1,
    ),
    FieldSubmission(
      id: 's6', documentType: 'delivery_note', status: 'approved',
      createdAt: '2026-07-18T14:10:00Z', co2eKg: 41.3, scope: 3, evidenceCount: 1,
    ),
    // Pending review — no co2e yet.
    FieldSubmission(
      id: 's7', documentType: 'waste_ticket', status: 'pending_review',
      createdAt: '2026-09-10T11:00:00Z', evidenceCount: 1,
    ),
    FieldSubmission(
      id: 's8', documentType: 'delivery_note', status: 'pending_review',
      createdAt: '2026-09-07T16:20:00Z', evidenceCount: 1,
    ),
    FieldSubmission(
      id: 's9', documentType: 'waste_ticket', status: 'pending_review',
      createdAt: '2026-08-25T09:55:00Z', evidenceCount: 1,
    ),
    FieldSubmission(
      id: 's10', documentType: 'fuel_receipt', status: 'pending_review',
      createdAt: '2026-06-14T08:00:00Z', evidenceCount: 1,
    ),
    // Submitted (synced, awaiting review queue).
    FieldSubmission(
      id: 's11', documentType: 'waste_ticket', status: 'submitted',
      createdAt: '2026-09-11T15:30:00Z', evidenceCount: 1,
    ),
    FieldSubmission(
      id: 's12', documentType: 'delivery_note', status: 'submitted',
      createdAt: '2026-06-03T09:15:00Z', evidenceCount: 1,
    ),
    // Older entries spread across the 6-month bar chart.
    FieldSubmission(
      id: 's13', documentType: 'waste_ticket', status: 'approved',
      createdAt: '2026-05-22T10:30:00Z', co2eKg: 78.5, scope: 3, evidenceCount: 1,
    ),
    FieldSubmission(
      id: 's14', documentType: 'fuel_receipt', status: 'approved',
      createdAt: '2026-04-17T07:45:00Z', co2eKg: 112.3, scope: 1, evidenceCount: 1,
    ),
    FieldSubmission(
      id: 's15', documentType: 'delivery_note', status: 'approved',
      createdAt: '2026-04-08T14:00:00Z', co2eKg: 29.8, scope: 3, evidenceCount: 1,
    ),
  ];

  static final List<Project> projects = [
    Project(
      id: 'p1',
      label: 'Canary Wharf Tower 2 - Site A',
      startDate: '2026-01-06T00:00:00Z',
      endDate: '2026-12-31T00:00:00Z',
      status: 'published',
      orgId: 'mock-org',
      orgName: orgName,
    ),
    Project(
      id: 'p2',
      label: 'Silvertown Logistics Hub',
      startDate: '2026-04-01T00:00:00Z',
      endDate: '2026-12-31T00:00:00Z',
      status: 'published',
      orgId: 'mock-org',
      orgName: orgName,
    ),
    Project(
      id: 'p3',
      label: 'Greenwich Residential Phase 3',
      startDate: '2026-06-01T00:00:00Z',
      endDate: '2026-12-31T00:00:00Z',
      status: 'draft',
      orgId: 'mock-org',
      orgName: orgName,
    ),
  ];
}
