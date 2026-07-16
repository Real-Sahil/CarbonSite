import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Status chip used on submissions and dashboard lists.
///
/// Recognised statuses: pending, syncing, submitted, approved, rejected,
/// failed. Anything else renders as a neutral chip with the raw label.
class SubmissionStatusChip extends StatelessWidget {
  final String status;
  final bool compact;

  const SubmissionStatusChip({
    super.key,
    required this.status,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final (label, icon, bg, fg) = _style(context);

    return Semantics(
      label: 'Status: $label',
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: compact ? 8 : 10,
          vertical: compact ? 3 : 5,
        ),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: compact ? 12 : 14, color: fg),
            const SizedBox(width: 4),
            Text(
              label,
              style: textTheme.labelSmall?.copyWith(
                color: fg,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }

  (String, IconData, Color, Color) _style(BuildContext context) {
    switch (status.toLowerCase()) {
      case 'pending':
        return (
          'Pending',
          Icons.schedule,
          StatusPalette.pendingBg,
          StatusPalette.pendingFg,
        );
      case 'syncing':
        return (
          'Syncing',
          Icons.sync,
          StatusPalette.syncingBg,
          StatusPalette.syncingFg,
        );
      case 'submitted':
        return (
          'Submitted',
          Icons.cloud_done_outlined,
          StatusPalette.submittedBg,
          StatusPalette.submittedFg,
        );
      case 'approved':
        return (
          'Approved',
          Icons.check_circle_outline,
          StatusPalette.approvedBg,
          StatusPalette.approvedFg,
        );
      case 'under_review':
        return (
          'In review',
          Icons.visibility_outlined,
          StatusPalette.syncingBg,
          StatusPalette.syncingFg,
        );
      case 'needs_info':
        return (
          'Needs info',
          Icons.info_outline,
          StatusPalette.pendingBg,
          StatusPalette.pendingFg,
        );
      case 'rejected':
        return (
          'Rejected',
          Icons.cancel_outlined,
          StatusPalette.rejectedBg,
          StatusPalette.rejectedFg,
        );
      case 'failed':
        return (
          'Failed',
          Icons.error_outline,
          StatusPalette.rejectedBg,
          StatusPalette.rejectedFg,
        );
      default:
        final scheme = Theme.of(context).colorScheme;
        return (
          status.isEmpty ? 'Unknown' : status,
          Icons.help_outline,
          scheme.surfaceContainerHighest,
          scheme.onSurfaceVariant,
        );
    }
  }
}
