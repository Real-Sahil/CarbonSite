import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/sync/sync_service.dart';
import '../theme/app_theme.dart';

/// Slim amber banner shown when the device has no network connection.
/// Drop it at the top of any screen body; renders nothing while online.
class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Assume online until connectivity reports otherwise (avoids a flash).
    final online = ref.watch(isOnlineProvider).value ?? true;
    final textTheme = Theme.of(context).textTheme;

    return AnimatedSize(
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOut,
      child: online
          ? const SizedBox.shrink()
          : Container(
              width: double.infinity,
              color: StatusPalette.pendingBg,
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  const Icon(
                    Icons.cloud_off_outlined,
                    size: 16,
                    color: StatusPalette.pendingFg,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Offline. Submissions are saved on this device and '
                      'will sync automatically.',
                      style: textTheme.bodySmall?.copyWith(
                        color: StatusPalette.pendingFg,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
