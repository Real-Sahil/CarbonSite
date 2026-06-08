import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/endpoints.dart';
import '../../core/offline/offline_submission_queue.dart';

class SubmissionsScreen extends StatefulWidget {
  const SubmissionsScreen({super.key});

  @override
  State<SubmissionsScreen> createState() => _SubmissionsScreenState();
}

class _SubmissionsScreenState extends State<SubmissionsScreen> {
  static const _storage = FlutterSecureStorage();
  bool _loading = true;
  String? _error;
  List<FieldSubmission> _submissions = [];
  List<QueuedSubmission> _queuedSubmissions = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final orgId = await _storage.read(key: 'org_id') ?? '';
      await OfflineSubmissionQueue.syncPending();
      final queuedSubmissions = await OfflineSubmissionQueue.pending();
      final submissions = await getMySubmissions(orgId);
      if (!mounted) return;
      setState(() {
        _submissions = submissions;
        _queuedSubmissions = queuedSubmissions;
        _loading = false;
      });
    } catch (_) {
      final queuedSubmissions = await OfflineSubmissionQueue.pending();
      if (!mounted) return;
      setState(() {
        _queuedSubmissions = queuedSubmissions;
        _loading = false;
        _error =
            'Could not load submissions. Check the connection and try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My submissions')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _buildBody(context),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/home'),
        icon: const Icon(Icons.add),
        label: const Text('Choose project'),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(_error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error)),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _load,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ],
      );
    }

    if (_submissions.isEmpty && _queuedSubmissions.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: const [
          Icon(Icons.inbox_outlined, size: 48),
          SizedBox(height: 16),
          Text('No submissions yet'),
          SizedBox(height: 8),
          Text('Choose a project and submit field evidence for review.'),
        ],
      );
    }

    final itemCount = _queuedSubmissions.length + _submissions.length;
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemBuilder: (context, index) {
        if (index < _queuedSubmissions.length) {
          final queued = _queuedSubmissions[index];
          return ListTile(
            leading: const Icon(Icons.cloud_off_outlined),
            title: Text(_documentLabel(queued.documentType)),
            subtitle: Text('Queued locally ${_formatDate(queued.createdAt)}'),
            trailing: const _StatusPill(status: 'queued'),
          );
        }
        final remoteIndex = index - _queuedSubmissions.length;
        final submission = _submissions[remoteIndex];
        return ListTile(
          leading: const Icon(Icons.description_outlined),
          title: Text(_documentLabel(submission.documentType)),
          subtitle: Text(_formatDate(submission.createdAt)),
          trailing: _StatusPill(status: submission.status),
        );
      },
      separatorBuilder: (_, __) => const Divider(),
      itemCount: itemCount,
    );
  }

  String _documentLabel(String value) {
    switch (value) {
      case 'waste_ticket':
        return 'Waste ticket';
      case 'delivery_note':
        return 'Delivery note';
      case 'fuel_receipt':
        return 'Fuel receipt';
      default:
        return 'Other evidence';
    }
  }

  String _formatDate(String raw) {
    if (raw.isEmpty) return 'Date unavailable';
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return raw;
    return '${parsed.day}/${parsed.month}/${parsed.year}';
  }
}

class _StatusPill extends StatelessWidget {
  final String status;

  const _StatusPill({required this.status});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isApproved = status == 'approved';
    final isRejected = status == 'rejected';
    return DecoratedBox(
      decoration: BoxDecoration(
        color: isApproved
            ? colorScheme.primaryContainer
            : isRejected
                ? colorScheme.errorContainer
                : colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        child: Text(
          status.replaceAll('_', ' '),
          style: Theme.of(context).textTheme.labelSmall,
        ),
      ),
    );
  }
}
