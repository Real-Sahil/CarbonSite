import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/api/endpoints.dart';
import '../../core/storage/app_database.dart';
import '../../core/widgets/offline_banner.dart';
import '../../core/widgets/status_chip.dart';
import '../sync/sync_service.dart';

/// The field worker's own submissions:
///
/// - "On this device" — local drafts still pending / syncing / failed,
///   streamed live from SQLite.
/// - "Submitted" — server copies (submitted / approved / rejected),
///   fetched from the API with pull-to-refresh.
class SubmissionsScreen extends ConsumerStatefulWidget {
  const SubmissionsScreen({super.key});

  @override
  ConsumerState<SubmissionsScreen> createState() => _SubmissionsScreenState();
}

class _SubmissionsScreenState extends ConsumerState<SubmissionsScreen> {
  static const _storage = FlutterSecureStorage();

  List<FieldSubmission> _remote = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    final orgId = await _storage.read(key: 'org_id') ?? '';
    if (orgId.isEmpty) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'No organisation found. Please contact your administrator.';
      });
      return;
    }

    try {
      final submissions = await getMySubmissions(orgId);
      if (!mounted) return;
      setState(() {
        _remote = submissions;
        _loading = false;
        _error = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        // Keep stale data on failure — offline is a normal state here.
        _error = _remote.isEmpty
            ? 'Could not reach the server. Local submissions are shown below.'
            : null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final drafts = ref.watch(localDraftsProvider).value ?? const [];

    // Local drafts still owned by this device. Synced drafts whose server
    // copy is already in the remote list are hidden to avoid duplicates.
    final remoteKeys = _remote
        .map((s) => s.clientKey)
        .whereType<String>()
        .toSet();
    final localDrafts = drafts.where((d) {
      if (d.status == DraftStatus.submitted.dbValue) {
        return !remoteKeys.contains(d.idempotencyKey) && _remote.isEmpty;
      }
      return true;
    }).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('My Submissions')),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _refresh,
                    child: (localDrafts.isEmpty &&
                            _remote.isEmpty &&
                            _error == null)
                        ? const _EmptySubmissions()
                        : ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding:
                                const EdgeInsets.fromLTRB(16, 12, 16, 96),
                            children: [
                              if (_error != null) ...[
                                _ErrorBanner(message: _error!),
                                const SizedBox(height: 12),
                              ],
                              if (localDrafts.isNotEmpty) ...[
                                const _SectionHeader(label: 'On this device'),
                                ...localDrafts.map(
                                  (d) => _DraftTile(
                                    draft: d,
                                    onRetry: () => ref
                                        .read(syncServiceProvider)
                                        .retryDraft(d.id),
                                  ),
                                ),
                                const SizedBox(height: 12),
                              ],
                              if (_remote.isNotEmpty) ...[
                                const _SectionHeader(label: 'Submitted'),
                                ..._remote.map(
                                  (s) => _RemoteTile(submission: s),
                                ),
                              ],
                            ],
                          ),
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/capture'),
        icon: const Icon(Icons.camera_alt),
        label: const Text('Capture'),
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Tiles
// -----------------------------------------------------------------------------

class _SectionHeader extends StatelessWidget {
  final String label;

  const _SectionHeader({required this.label});

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 8, 4, 8),
      child: Text(
        label.toUpperCase(),
        style: textTheme.labelSmall?.copyWith(
          color: colorScheme.onSurfaceVariant,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

class _DraftTile extends StatelessWidget {
  final DraftSubmission draft;
  final VoidCallback onRetry;

  const _DraftTile({required this.draft, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final failed = draft.status == DraftStatus.failed.dbValue;
    final summary = _summarize(draft);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: failed ? colorScheme.error : colorScheme.outlineVariant,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  _docIcon(draft.documentType),
                  size: 22,
                  color: colorScheme.primary,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _docLabel(draft.documentType),
                        style: textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        [
                          DateFormat('d MMM yyyy, HH:mm')
                              .format(draft.createdAt.toLocal()),
                          if (summary.isNotEmpty) summary,
                        ].join(' · '),
                        style: textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                SubmissionStatusChip(status: draft.status, compact: true),
              ],
            ),
            if (failed) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      draft.syncError ?? 'Upload failed',
                      style: textTheme.bodySmall?.copyWith(
                        color: colorScheme.error,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  TextButton.icon(
                    onPressed: onRetry,
                    icon: const Icon(Icons.refresh, size: 16),
                    label: const Text('Retry'),
                    style: TextButton.styleFrom(
                      foregroundColor: colorScheme.error,
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      visualDensity: VisualDensity.compact,
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// One-line human summary out of the stored form JSON.
  String _summarize(DraftSubmission draft) {
    try {
      final data = jsonDecode(draft.formData) as Map<String, dynamic>;
      final parts = <String>[];
      if (data['weight'] != null) {
        parts.add('${data['weight']} ${data['weightUnit'] ?? ''}'.trim());
      }
      if (data['volume'] != null) parts.add('${data['volume']} litres');
      if (data['ewcCode'] != null) parts.add('EWC ${data['ewcCode']}');
      if (data['materialType'] != null) parts.add('${data['materialType']}');
      return parts.take(2).join(' · ');
    } catch (_) {
      return '';
    }
  }
}

class _RemoteTile extends StatelessWidget {
  final FieldSubmission submission;

  const _RemoteTile({required this.submission});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final dt = DateTime.tryParse(submission.createdAt);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: () => context.push('/submissions/${submission.id}'),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: colorScheme.outlineVariant),
          ),
          child: Row(
            children: [
              Icon(
                _docIcon(submission.documentType),
                size: 22,
                color: colorScheme.primary,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _docLabel(submission.documentType),
                      style: textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      dt == null
                          ? submission.createdAt
                          : DateFormat('d MMM yyyy, HH:mm').format(dt.toLocal()),
                      style: textTheme.bodySmall?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              SubmissionStatusChip(status: submission.status, compact: true),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptySubmissions extends StatelessWidget {
  const _EmptySubmissions();

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    // Inside a RefreshIndicator the empty state must still scroll.
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const SizedBox(height: 120),
        Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Column(
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: colorScheme.surfaceContainerHighest,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.receipt_long_outlined,
                    size: 36,
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'No submissions yet',
                  style: textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Photograph a waste ticket, delivery note or fuel receipt '
                  'to make your first submission.',
                  style: textTheme.bodyMedium?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  final String message;

  const _ErrorBanner({required this.message});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline,
              size: 18, color: colorScheme.onSurfaceVariant),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: textTheme.bodySmall?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// Shared helpers ------------------------------------------------------------

IconData _docIcon(String documentType) {
  switch (documentType) {
    case 'waste_ticket':
      return Icons.delete_outline;
    case 'delivery_note':
      return Icons.local_shipping_outlined;
    case 'fuel_receipt':
      return Icons.local_gas_station_outlined;
    default:
      return Icons.description_outlined;
  }
}

String _docLabel(String documentType) {
  switch (documentType) {
    case 'waste_ticket':
      return 'Waste Ticket';
    case 'delivery_note':
      return 'Delivery Note';
    case 'fuel_receipt':
      return 'Fuel Receipt';
    default:
      return 'Document';
  }
}
