import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/api/endpoints.dart';
import '../../core/storage/app_database.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/offline_banner.dart';
import '../../core/widgets/status_chip.dart';

/// Field worker dashboard.
///
/// Shows ONLY this worker's own submission aggregate — co2e estimates,
/// scope split and trend are computed from `getMySubmissions`, never from
/// org-wide data (field_worker role has zero org dashboard access).
class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  static const _storage = FlutterSecureStorage();

  List<FieldSubmission> _submissions = [];
  bool _loading = true;
  String? _error;
  String _userName = '';
  String _orgName = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final orgId = await _storage.read(key: 'org_id') ?? '';
    final userName = await _storage.read(key: 'user_name') ?? '';
    final orgName = await _storage.read(key: 'org_name') ?? '';
    if (!mounted) return;
    setState(() {
      _userName = userName;
      _orgName = orgName;
    });

    if (orgId.isEmpty) {
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
        _submissions = submissions;
        _loading = false;
        _error = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        // Offline is normal for this app — show whatever we have locally.
        _error = _submissions.isEmpty
            ? 'Could not load your submissions. Pull down to retry.'
            : null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final drafts = ref.watch(localDraftsProvider).value ?? const [];
    final stats = _DashboardStats.compute(_submissions, drafts);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _userName.isEmpty ? 'Dashboard' : 'Hello, ${_firstName(_userName)}',
              style: textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: -0.3,
              ),
            ),
            if (_orgName.isNotEmpty)
              Text(
                _orgName,
                style: textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                  height: 1.2,
                ),
              ),
          ],
        ),
      ),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                      children: [
                        if (_error != null) ...[
                          _InfoCard(message: _error!),
                          const SizedBox(height: 16),
                        ],
                        _TotalCard(stats: stats),
                        const SizedBox(height: 16),
                        if (stats.scopeValues.isNotEmpty) ...[
                          _SectionTitle(
                            title: 'Emissions by scope',
                            subtitle: stats.hasCo2eData
                                ? 'Estimated CO2e from your approved submissions'
                                : 'By number of submissions (estimates appear '
                                    'after review)',
                          ),
                          const SizedBox(height: 12),
                          _ScopeDonut(stats: stats),
                          const SizedBox(height: 24),
                        ],
                        if (stats.monthlyCounts.isNotEmpty) ...[
                          const _SectionTitle(
                            title: 'Monthly submissions',
                            subtitle: 'Documents submitted, last 6 months',
                          ),
                          const SizedBox(height: 12),
                          _MonthlyBarChart(stats: stats),
                          const SizedBox(height: 24),
                        ],
                        const _SectionTitle(
                          title: 'Data summary',
                          subtitle: 'The figures behind the charts',
                        ),
                        const SizedBox(height: 8),
                        _TextSummary(stats: stats),
                        const SizedBox(height: 24),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const _SectionTitle(title: 'Recent submissions'),
                            TextButton(
                              onPressed: () => context.go('/submissions'),
                              child: const Text('View all'),
                            ),
                          ],
                        ),
                        if (_submissions.isEmpty)
                          _InfoCard(
                            message: drafts.isEmpty
                                ? 'No submissions yet. Photograph your first '
                                    'waste ticket or delivery note.'
                                : 'Your submissions are waiting to sync.',
                          )
                        else
                          ..._submissions.take(5).map(
                                (s) => _RecentTile(submission: s),
                              ),
                        const SizedBox(height: 12),
                        FilledButton.icon(
                          onPressed: () => context.push('/capture'),
                          icon: const Icon(Icons.camera_alt_outlined),
                          label: const Text('Capture document'),
                        ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  String _firstName(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    return parts.isEmpty ? name : parts.first;
  }
}

// -----------------------------------------------------------------------------
// Aggregation — deterministic, pure
// -----------------------------------------------------------------------------

class _DashboardStats {
  final double totalCo2eKg;
  final bool hasCo2eData;

  /// scope number -> value (kg CO2e when [hasCo2eData], else count)
  final Map<int, double> scopeValues;

  /// Newest-last list of (month label, count) for the last 6 months.
  final List<(String, int)> monthlyCounts;

  final int totalCount;
  final int approvedCount;
  final int awaitingSyncCount;

  const _DashboardStats({
    required this.totalCo2eKg,
    required this.hasCo2eData,
    required this.scopeValues,
    required this.monthlyCounts,
    required this.totalCount,
    required this.approvedCount,
    required this.awaitingSyncCount,
  });

  static _DashboardStats compute(
    List<FieldSubmission> submissions,
    List<DraftSubmission> drafts,
  ) {
    var totalCo2e = 0.0;
    var hasCo2e = false;
    final scopeValues = <int, double>{};

    for (final s in submissions) {
      if (s.co2eKg != null) {
        hasCo2e = true;
        totalCo2e += s.co2eKg!;
      }
    }

    // Donut values: kg CO2e when available, otherwise submission counts so
    // the chart still tells a story before anything has been calculated.
    for (final s in submissions) {
      final scope = s.scope ?? _inferScope(s.documentType);
      final value = hasCo2e ? (s.co2eKg ?? 0) : 1.0;
      if (value <= 0) continue;
      scopeValues.update(scope, (v) => v + value, ifAbsent: () => value);
    }

    // Monthly counts for the trailing 6 calendar months.
    final now = DateTime.now();
    final buckets = <String, int>{};
    final labels = <String>[];
    for (var i = 5; i >= 0; i--) {
      final month = DateTime(now.year, now.month - i);
      final label = DateFormat('MMM').format(month);
      labels.add(label);
      buckets['${month.year}-${month.month}'] = 0;
    }
    for (final s in submissions) {
      final dt = DateTime.tryParse(s.createdAt);
      if (dt == null) continue;
      final key = '${dt.year}-${dt.month}';
      if (buckets.containsKey(key)) {
        buckets[key] = buckets[key]! + 1;
      }
    }
    final monthly = <(String, int)>[];
    final values = buckets.values.toList();
    for (var i = 0; i < labels.length; i++) {
      monthly.add((labels[i], values[i]));
    }

    final awaitingSync = drafts
        .where((d) => d.status == 'pending' || d.status == 'syncing')
        .length;

    return _DashboardStats(
      totalCo2eKg: totalCo2e,
      hasCo2eData: hasCo2e,
      scopeValues: scopeValues,
      monthlyCounts: monthly,
      totalCount: submissions.length,
      approvedCount: submissions
          .where((s) => s.status.toLowerCase() == 'approved')
          .length,
      awaitingSyncCount: awaitingSync,
    );
  }

  /// Client-side fallback when the server has not assigned a scope yet:
  /// fuel burned on site is Scope 1; waste and deliveries are Scope 3.
  static int _inferScope(String documentType) {
    switch (documentType) {
      case 'fuel_receipt':
        return 1;
      default:
        return 3;
    }
  }
}

// -----------------------------------------------------------------------------
// Widgets
// -----------------------------------------------------------------------------

class _SectionTitle extends StatelessWidget {
  final String title;
  final String? subtitle;

  const _SectionTitle({required this.title, this.subtitle});

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 2),
          Text(
            subtitle!,
            style: textTheme.bodySmall?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ],
    );
  }
}

class _TotalCard extends StatelessWidget {
  final _DashboardStats stats;

  const _TotalCard({required this.stats});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final tonnes = stats.totalCo2eKg / 1000;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colorScheme.primary,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Your estimated emissions',
            style: textTheme.labelLarge?.copyWith(
              color: colorScheme.onPrimary.withValues(alpha: 0.85),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                stats.hasCo2eData ? NumberFormat('#,##0.00').format(tonnes) : '—',
                style: textTheme.displaySmall?.copyWith(
                  color: colorScheme.onPrimary,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -1,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'tCO2e',
                style: textTheme.titleSmall?.copyWith(
                  color: colorScheme.onPrimary.withValues(alpha: 0.85),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          if (!stats.hasCo2eData) ...[
            const SizedBox(height: 4),
            Text(
              'Estimates appear once your submissions are approved.',
              style: textTheme.bodySmall?.copyWith(
                color: colorScheme.onPrimary.withValues(alpha: 0.8),
              ),
            ),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              _MiniStat(
                label: 'Submitted',
                value: '${stats.totalCount}',
                color: colorScheme.onPrimary,
              ),
              _MiniStat(
                label: 'Approved',
                value: '${stats.approvedCount}',
                color: colorScheme.onPrimary,
              ),
              _MiniStat(
                label: 'Awaiting sync',
                value: '${stats.awaitingSyncCount}',
                color: colorScheme.onPrimary,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _MiniStat({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: textTheme.titleLarge?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            label,
            style: textTheme.labelSmall?.copyWith(
              color: color.withValues(alpha: 0.8),
            ),
          ),
        ],
      ),
    );
  }
}

class _ScopeDonut extends StatelessWidget {
  final _DashboardStats stats;

  const _ScopeDonut({required this.stats});

  static const _scopeColors = {
    1: StatusPalette.scope1,
    2: StatusPalette.scope2,
    3: StatusPalette.scope3,
  };

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final scopes = stats.scopeValues.keys.toList()..sort();
    final total = stats.scopeValues.values.fold<double>(0, (a, b) => a + b);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Row(
        children: [
          // Exclude from semantics — the text summary below carries the data.
          ExcludeSemantics(
            child: SizedBox(
              width: 140,
              height: 140,
              child: PieChart(
                PieChartData(
                  sectionsSpace: 2,
                  centerSpaceRadius: 38,
                  startDegreeOffset: -90,
                  sections: [
                    for (final scope in scopes)
                      PieChartSectionData(
                        value: stats.scopeValues[scope]!,
                        color: _scopeColors[scope] ?? StatusPalette.scope3,
                        radius: 28,
                        showTitle: false,
                      ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final scope in scopes) ...[
                  Row(
                    children: [
                      Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: _scopeColors[scope] ?? StatusPalette.scope3,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Scope $scope',
                          style: textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      Text(
                        total <= 0
                            ? '0%'
                            : '${(stats.scopeValues[scope]! / total * 100).round()}%',
                        style: textTheme.bodyMedium?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                ],
                Text(
                  stats.hasCo2eData
                      ? 'Share of your estimated CO2e'
                      : 'Share of your submissions',
                  style: textTheme.bodySmall?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MonthlyBarChart extends StatelessWidget {
  final _DashboardStats stats;

  const _MonthlyBarChart({required this.stats});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final maxCount = stats.monthlyCounts
        .map((m) => m.$2)
        .fold<int>(0, (a, b) => a > b ? a : b);

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: ExcludeSemantics(
        child: SizedBox(
          height: 160,
          child: BarChart(
            BarChartData(
              maxY: (maxCount == 0 ? 1 : maxCount).toDouble() * 1.2,
              gridData: const FlGridData(show: false),
              borderData: FlBorderData(show: false),
              barTouchData: BarTouchData(enabled: false),
              titlesData: FlTitlesData(
                topTitles: const AxisTitles(
                  sideTitles: SideTitles(showTitles: false),
                ),
                rightTitles: const AxisTitles(
                  sideTitles: SideTitles(showTitles: false),
                ),
                leftTitles: const AxisTitles(
                  sideTitles: SideTitles(showTitles: false),
                ),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 28,
                    getTitlesWidget: (value, meta) {
                      final index = value.toInt();
                      if (index < 0 || index >= stats.monthlyCounts.length) {
                        return const SizedBox.shrink();
                      }
                      return Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          stats.monthlyCounts[index].$1,
                          style: textTheme.labelSmall?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
              barGroups: [
                for (var i = 0; i < stats.monthlyCounts.length; i++)
                  BarChartGroupData(
                    x: i,
                    barRods: [
                      BarChartRodData(
                        toY: stats.monthlyCounts[i].$2.toDouble(),
                        width: 18,
                        color: StatusPalette.scope1,
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(4),
                        ),
                        backDrawRodData: BackgroundBarChartRodData(
                          show: true,
                          toY: (maxCount == 0 ? 1 : maxCount).toDouble() * 1.2,
                          color: colorScheme.surfaceContainerHighest,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Plain-text equivalent of the charts — screen-reader friendly and useful
/// for users who prefer numbers over visuals.
class _TextSummary extends StatelessWidget {
  final _DashboardStats stats;

  const _TextSummary({required this.stats});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final scopes = stats.scopeValues.keys.toList()..sort();
    final total = stats.scopeValues.values.fold<double>(0, (a, b) => a + b);

    final rows = <(String, String)>[
      if (stats.hasCo2eData)
        (
          'Total estimated CO2e',
          '${NumberFormat('#,##0.00').format(stats.totalCo2eKg / 1000)} tonnes',
        ),
      ('Total submissions', '${stats.totalCount}'),
      ('Approved', '${stats.approvedCount}'),
      ('Awaiting sync on this device', '${stats.awaitingSyncCount}'),
      for (final scope in scopes)
        (
          'Scope $scope',
          stats.hasCo2eData
              ? '${NumberFormat('#,##0.0').format(stats.scopeValues[scope])} kg CO2e'
                  '${total > 0 ? ' (${(stats.scopeValues[scope]! / total * 100).round()}%)' : ''}'
              : '${stats.scopeValues[scope]!.round()} submissions'
                  '${total > 0 ? ' (${(stats.scopeValues[scope]! / total * 100).round()}%)' : ''}',
        ),
      for (final month in stats.monthlyCounts)
        ('Submissions in ${month.$1}', '${month.$2}'),
    ];

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) const Divider(height: 1),
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      rows[i].$1,
                      style: textTheme.bodyMedium?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                  Text(
                    rows[i].$2,
                    style: textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _RecentTile extends StatelessWidget {
  final FieldSubmission submission;

  const _RecentTile({required this.submission});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: colorScheme.outlineVariant),
        ),
        child: Row(
          children: [
            Icon(
              _icon(submission.documentType),
              size: 22,
              color: colorScheme.primary,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _label(submission.documentType),
                    style: textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    _formatDate(submission.createdAt),
                    style: textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            SubmissionStatusChip(status: submission.status, compact: true),
          ],
        ),
      ),
    );
  }

  IconData _icon(String documentType) {
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

  String _label(String documentType) {
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

  String _formatDate(String raw) {
    final dt = DateTime.tryParse(raw);
    if (dt == null) return raw;
    return DateFormat('d MMM yyyy, HH:mm').format(dt.toLocal());
  }
}

class _InfoCard extends StatelessWidget {
  final String message;

  const _InfoCard({required this.message});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        message,
        style: textTheme.bodyMedium?.copyWith(
          color: colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}
