import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api/endpoints.dart';
import '../../core/widgets/offline_banner.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  static const _storage = FlutterSecureStorage();

  List<OrgReport> _reports = [];
  bool _loading = true;
  String? _error;
  String? _orgId;

  // Track which report IDs are currently fetching a download URL.
  final Set<String> _downloading = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final orgId = await _storage.read(key: 'org_id') ?? '';
    setState(() => _orgId = orgId.isEmpty ? null : orgId);

    if (orgId.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'No organisation found. Contact your administrator.';
      });
      return;
    }

    try {
      final reports = await getOrgReports(orgId);
      if (!mounted) return;
      setState(() {
        _reports = reports;
        _loading = false;
        _error = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Could not load reports. Pull down to retry.';
      });
    }
  }

  Future<void> _shareReport(OrgReport report, {String artifact = 'pdf'}) async {
    if (_orgId == null) return;
    setState(() => _downloading.add(report.id));
    try {
      final url = await getReportDownloadUrl(_orgId!, report.id, artifact: artifact);
      if (!mounted) return;
      await Share.shareUri(Uri.parse(url));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not get download link. Try again.')),
      );
    } finally {
      if (mounted) setState(() => _downloading.remove(report.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reports'),
      ),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: _reports.isEmpty
                        ? _EmptyState(error: _error)
                        : ListView.builder(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                            itemCount: _reports.length,
                            itemBuilder: (context, index) {
                              final report = _reports[index];
                              return _ReportCard(
                                report: report,
                                isDownloading: _downloading.contains(report.id),
                                onSharePdf: report.status == 'ready' && report.hasPdf
                                    ? () => _shareReport(report, artifact: 'pdf')
                                    : null,
                                onShareCsv: report.status == 'ready' && report.hasCsv
                                    ? () => _shareReport(report, artifact: 'csv')
                                    : null,
                              );
                            },
                          ),
                  ),
          ),
        ],
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Sub-widgets
// -----------------------------------------------------------------------------

class _ReportCard extends StatelessWidget {
  final OrgReport report;
  final bool isDownloading;
  final VoidCallback? onSharePdf;
  final VoidCallback? onShareCsv;

  const _ReportCard({
    required this.report,
    required this.isDownloading,
    this.onSharePdf,
    this.onShareCsv,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final isReady = report.status == 'ready';
    final isFailed = report.status == 'failed';

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: colorScheme.outlineVariant),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          report.typeLabel,
                          style: textTheme.bodyLarge?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${report.periodLabel}  ·  v${report.snapshotVersion}',
                          style: textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _formatDate(report.createdAt),
                          style: textTheme.labelSmall?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  _StatusChip(status: report.status),
                ],
              ),
            ),
            if (isReady && (report.hasPdf || report.hasCsv)) ...[
              const Divider(height: 1),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                child: Row(
                  children: [
                    if (isDownloading) ...[
                      const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        'Getting link…',
                        style: textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ] else ...[
                      if (report.hasPdf)
                        TextButton.icon(
                          onPressed: onSharePdf,
                          icon: const Icon(Icons.picture_as_pdf_outlined, size: 18),
                          label: const Text('Share PDF'),
                        ),
                      if (report.hasCsv)
                        TextButton.icon(
                          onPressed: onShareCsv,
                          icon: const Icon(Icons.table_chart_outlined, size: 18),
                          label: const Text('Share CSV'),
                        ),
                    ],
                  ],
                ),
              ),
            ] else if (isFailed) ...[
              const Divider(height: 1),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 8, 14, 12),
                child: Text(
                  'Generation failed. Contact your sustainability manager to regenerate.',
                  style: textTheme.bodySmall?.copyWith(
                    color: colorScheme.error,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatDate(String raw) {
    final dt = DateTime.tryParse(raw);
    if (dt == null) return raw;
    return DateFormat('d MMM yyyy').format(dt.toLocal());
  }
}

class _StatusChip extends StatelessWidget {
  final String status;

  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final (bg, fg, label) = switch (status) {
      'ready'      => (const Color(0xFFe1f4df), const Color(0xFF0f3e17), 'Ready'),
      'failed'     => (colorScheme.errorContainer, colorScheme.onErrorContainer, 'Failed'),
      'generating' => (colorScheme.primaryContainer, colorScheme.onPrimaryContainer, 'Generating'),
      _            => (colorScheme.surfaceContainerHighest, colorScheme.onSurfaceVariant, 'Queued'),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: fg,
              fontWeight: FontWeight.w600,
            ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final String? error;

  const _EmptyState({this.error});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        SizedBox(height: MediaQuery.of(context).size.height * 0.25),
        Center(
          child: Column(
            children: [
              Icon(Icons.description_outlined, size: 48, color: colorScheme.onSurfaceVariant),
              const SizedBox(height: 16),
              Text(
                error ?? 'No reports yet',
                style: textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Reports appear here once your sustainability manager\ngenerates them from a published snapshot.',
                style: textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
