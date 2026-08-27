import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'dart:io';
import '../../core/api/endpoints.dart';
import '../../core/widgets/status_chip.dart';

class SubmissionDetailScreen extends StatefulWidget {
  final String submissionId;
  const SubmissionDetailScreen({super.key, required this.submissionId});

  @override
  State<SubmissionDetailScreen> createState() => _SubmissionDetailScreenState();
}

class _SubmissionDetailScreenState extends State<SubmissionDetailScreen> {
  static const _storage = FlutterSecureStorage();
  FieldSubmissionDetail? _detail;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final orgId = await _storage.read(key: 'org_id') ?? '';
    if (!mounted) return;

    if (orgId.isEmpty) {
      setState(() { _loading = false; _error = 'No organisation found.'; });
      return;
    }

    try {
      final detail = await getSubmissionDetail(orgId, widget.submissionId);
      if (!mounted) return;
      setState(() { _detail = detail; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _loading = false; _error = 'Could not load submission. Pull down to retry.'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Submission Details')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _ErrorBody(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
                    children: [
                      _buildHeader(colorScheme, textTheme),
                      const SizedBox(height: 20),
                      if (_detail!.co2eKg != null) ...[
                        _buildCo2eCard(colorScheme, textTheme),
                        const SizedBox(height: 16),
                      ],
                      if (_detail!.reviewNote != null && _detail!.reviewNote!.isNotEmpty) ...[
                        _buildReviewNote(colorScheme, textTheme),
                        const SizedBox(height: 16),
                      ],
                      if (_detail!.evidenceFiles.isNotEmpty) ...[
                        _buildEvidenceSection(colorScheme, textTheme),
                        const SizedBox(height: 16),
                      ],
                      const SizedBox(height: 8),
                      // Corrections apply to rejected AND needs-info reviews —
                      // both are reviewer requests for the worker to act.
                      if (_detail!.status == 'rejected' ||
                          _detail!.status == 'needs_info')
                        FilledButton.icon(
                          onPressed: () {
                            // Carry the original site so the corrected draft
                            // can actually sync (siteId is required).
                            final siteId = _detail!.siteId;
                            final target = siteId != null && siteId.isNotEmpty
                                ? '/capture?projectId=${Uri.encodeQueryComponent(siteId)}'
                                : '/capture';
                            context.push(
                              target,
                              extra: {
                                'resubmittedFromId': _detail!.id,
                                'documentType': _detail!.documentType,
                              },
                            );
                          },
                          icon: const Icon(Icons.edit_document),
                          label: const Text('Submit correction'),
                        )
                      else
                        FilledButton.icon(
                          onPressed: () => context.push('/capture'),
                          icon: const Icon(Icons.camera_alt_outlined),
                          label: const Text('Submit new document'),
                        ),
                    ],
                  ),
                ),
    );
  }

  Widget _buildHeader(ColorScheme colorScheme, TextTheme textTheme) {
    final d = _detail!;
    final dt = DateTime.tryParse(d.createdAt);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SubmissionStatusChip(status: d.status),
        const SizedBox(height: 12),
        Text(_docLabel(d.documentType), style: textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text(
          dt == null ? d.createdAt : DateFormat('d MMM yyyy, HH:mm').format(dt.toLocal()),
          style: textTheme.bodyMedium?.copyWith(color: colorScheme.onSurfaceVariant),
        ),
        if (d.scope != null) ...[
          const SizedBox(height: 4),
          Text('Scope ${d.scope}', style: textTheme.bodySmall?.copyWith(color: colorScheme.onSurfaceVariant)),
        ],
      ],
    );
  }

  Widget _buildCo2eCard(ColorScheme colorScheme, TextTheme textTheme) {
    final tonnes = _detail!.co2eKg! / 1000;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF0f3e17),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Estimated emissions', style: textTheme.labelMedium?.copyWith(color: Colors.white70)),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                NumberFormat('#,##0.00').format(tonnes),
                style: textTheme.headlineMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w800),
              ),
              const SizedBox(width: 6),
              Text('tCO₂e', style: textTheme.titleSmall?.copyWith(color: Colors.white70)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildReviewNote(ColorScheme colorScheme, TextTheme textTheme) {
    final isRejected = _detail!.status == 'rejected' || _detail!.status == 'needs_info';
    final bg = isRejected ? const Color(0xFFFFF8E1) : const Color(0xFFE1F4DF);
    final border = isRejected ? const Color(0xFFF9A825) : const Color(0xFF4CAF50);
    final label = isRejected ? 'Reviewer note — action needed' : 'Reviewer note';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bg,
        border: Border(left: BorderSide(color: border, width: 3)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w700, color: const Color(0xFF333333))),
          const SizedBox(height: 6),
          Text(_detail!.reviewNote!, style: textTheme.bodyMedium?.copyWith(color: const Color(0xFF222222))),
        ],
      ),
    );
  }

  Widget _buildEvidenceSection(ColorScheme colorScheme, TextTheme textTheme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Evidence files', style: textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        ...(_detail!.evidenceFiles.map((file) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: colorScheme.outlineVariant),
            ),
            child: Row(
              children: [
                Icon(Icons.attach_file, size: 20, color: colorScheme.onSurfaceVariant),
                const SizedBox(width: 10),
                Expanded(child: Text(file.filename, style: textTheme.bodyMedium, overflow: TextOverflow.ellipsis)),
                if ((file.photoLocalPath?.isNotEmpty == true) || (file.downloadUrl?.isNotEmpty == true))
                  TextButton(
                    onPressed: () => _showImageViewer(file.filename, file.photoLocalPath, file.downloadUrl),
                    child: const Text('View'),
                  ),
              ],
            ),
          ),
        ))),
      ],
    );
  }

  String _docLabel(String type) {
    switch (type) {
      case 'waste_ticket': return 'Waste Ticket';
      case 'delivery_note': return 'Delivery Note';
      case 'fuel_receipt': return 'Fuel Receipt';
      default: return 'Document';
    }
  }

  void _showImageViewer(String filename, String? localPath, [String? remoteUrl]) {
    final isLocal = localPath?.isNotEmpty == true;

    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        child: GestureDetector(
          onTap: () => Navigator.pop(context),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AppBar(
                leading: IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
                title: Text(filename, style: Theme.of(context).textTheme.titleMedium),
                backgroundColor: Colors.black87,
                foregroundColor: Colors.white,
              ),
              Expanded(
                child: !isLocal && remoteUrl?.isEmpty != false
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.image_not_supported, size: 48, color: Theme.of(context).colorScheme.error),
                            const SizedBox(height: 16),
                            const Text('No image available'),
                          ],
                        ),
                      )
                    : isLocal
                        ? Image.file(
                            File(localPath!),
                            fit: BoxFit.contain,
                            errorBuilder: (context, error, stackTrace) => Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.error_outline, size: 48, color: Theme.of(context).colorScheme.error),
                                  const SizedBox(height: 16),
                                  const Text('Could not load image'),
                                ],
                              ),
                            ),
                          )
                        : Image.network(
                            remoteUrl!,
                            fit: BoxFit.contain,
                            errorBuilder: (context, error, stackTrace) => Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.error_outline, size: 48, color: Theme.of(context).colorScheme.error),
                                  const SizedBox(height: 16),
                                  const Text('Could not load image'),
                                ],
                              ),
                            ),
                            loadingBuilder: (context, child, loadingProgress) {
                              if (loadingProgress == null) return child;
                              return Center(
                                child: CircularProgressIndicator(
                                  value: loadingProgress.expectedTotalBytes != null
                                      ? loadingProgress.cumulativeBytesLoaded / loadingProgress.expectedTotalBytes!
                                      : null,
                                ),
                              );
                            },
                          ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ErrorBody extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorBody({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.error_outline, size: 48, color: colorScheme.onSurfaceVariant),
          const SizedBox(height: 16),
          Text(message, style: textTheme.bodyMedium?.copyWith(color: colorScheme.onSurfaceVariant), textAlign: TextAlign.center),
          const SizedBox(height: 16),
          OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Retry')),
        ],
      ),
    );
  }
}
