import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

import '../../core/api/endpoints.dart';
import '../../core/storage/app_database.dart';
import '../sync/sync_service.dart';

/// Logs social value delivery (jobs, pay, training) against one of the
/// contract's KPIs, e.g. "2 apprenticeship starts" or "36 training hours".
///
/// The KPI list comes from the server and is cached per site, so a worker
/// who has opened it once can log offline. The entry is saved to SQLite
/// first and synced like any other submission; a reviewer's approval adds it
/// to the contract's delivery log with the photo as evidence.
class SocialValueScreen extends ConsumerStatefulWidget {
  final String? projectId;
  final String? projectLabel;
  final String? resubmittedFromId;

  const SocialValueScreen({
    super.key,
    this.projectId,
    this.projectLabel,
    this.resubmittedFromId,
  });

  @override
  ConsumerState<SocialValueScreen> createState() => _SocialValueScreenState();
}

class _SocialValueScreenState extends ConsumerState<SocialValueScreen> {
  static const _storage = FlutterSecureStorage();

  final _formKey = GlobalKey<FormState>();
  final _quantityController = TextEditingController();
  final _noteController = TextEditingController();
  final _picker = ImagePicker();
  final _uuid = const Uuid();

  List<Project> _sites = [];
  String? _siteId;
  String? _siteLabel;

  SiteSocialValue? _siteValue;
  bool _loadingKpis = false;
  String? _loadError;
  String? _kpiId;

  DateTime _date = DateTime.now();
  String? _photoPath;
  bool _submitting = false;

  SocialValueKpi? get _kpi {
    for (final k in _siteValue?.kpis ?? const <SocialValueKpi>[]) {
      if (k.id == _kpiId) return k;
    }
    return null;
  }

  @override
  void initState() {
    super.initState();
    if (widget.projectId != null && widget.projectId!.isNotEmpty) {
      _siteId = widget.projectId;
      _siteLabel = widget.projectLabel;
      _loadKpis();
    } else {
      _loadSites();
    }
  }

  @override
  void dispose() {
    _quantityController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _loadSites() async {
    try {
      final orgId = await _storage.read(key: 'org_id') ?? '';
      if (orgId.isEmpty) return;
      final sites = await getProjects(orgId);
      if (!mounted) return;
      setState(() {
        _sites = sites;
        if (sites.length == 1) {
          _siteId = sites.first.id;
          _siteLabel = sites.first.label;
        }
      });
      if (_siteId != null) await _loadKpis();
    } catch (_) {
      if (mounted) {
        setState(() => _loadError = 'Could not load your sites. Check your connection.');
      }
    }
  }

  String _cacheKey(String siteId) => 'sv_kpis_$siteId';

  Future<void> _loadKpis() async {
    final siteId = _siteId;
    if (siteId == null || siteId.isEmpty) return;
    setState(() {
      _loadingKpis = true;
      _loadError = null;
      _siteValue = null;
      _kpiId = null;
    });
    try {
      final orgId = await _storage.read(key: 'org_id') ?? '';
      final value = await getSiteSocialValue(orgId, siteId);
      await _storage.write(
        key: _cacheKey(siteId),
        value: jsonEncode({
          'enabled': value.enabled,
          'contractName': value.contractName,
          'kpis': [
            for (final k in value.kpis)
              {
                'id': k.id,
                'title': k.title,
                'unit': k.unit,
                'target': k.target,
                'criterion': k.criterion,
              },
          ],
        }),
      );
      if (!mounted) return;
      setState(() => _siteValue = value);
    } catch (_) {
      // Offline: fall back to the KPIs last loaded for this site.
      final cached = await _storage.read(key: _cacheKey(siteId));
      if (!mounted) return;
      if (cached != null) {
        try {
          setState(() => _siteValue =
              SiteSocialValue.fromJson(jsonDecode(cached) as Map<String, dynamic>));
        } catch (_) {
          setState(() => _loadError = 'Could not load the KPIs. Connect and try again.');
        }
      } else {
        setState(() => _loadError = 'Could not load the KPIs. Connect and try again.');
      }
    } finally {
      if (mounted) {
        setState(() {
          _loadingKpis = false;
          final kpis = _siteValue?.kpis ?? const <SocialValueKpi>[];
          if (kpis.length == 1) _kpiId = kpis.first.id;
        });
      }
    }
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(now.year - 2),
      lastDate: now,
    );
    if (picked != null && mounted) setState(() => _date = picked);
  }

  Future<void> _addPhoto(ImageSource source) async {
    final shot = await _picker.pickImage(source: source, imageQuality: 80, maxWidth: 2400);
    if (shot == null) return;
    // Keep a copy in app storage so the draft survives the picker's temp
    // file being cleared before the sync runs.
    final dir = await getApplicationDocumentsDirectory();
    final ext = p.extension(shot.path).isEmpty ? '.jpg' : p.extension(shot.path);
    final dest = p.join(dir.path, 'sv_${_uuid.v4()}$ext');
    await File(shot.path).copy(dest);
    if (mounted) setState(() => _photoPath = dest);
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final kpi = _kpi;
    if (_siteId == null || kpi == null) return;
    setState(() => _submitting = true);

    final formData = <String, dynamic>{
      'commitmentId': kpi.id,
      'kpiTitle': kpi.title,
      'quantity': double.parse(_quantityController.text.trim()),
      if (kpi.unit != null) 'unit': kpi.unit,
      'activityDate': DateFormat('yyyy-MM-dd').format(_date),
      if (_noteController.text.trim().isNotEmpty) 'note': _noteController.text.trim(),
      if (widget.resubmittedFromId != null) 'resubmittedFromId': widget.resubmittedFromId,
    };

    final draftId = _uuid.v4();
    try {
      final db = ref.read(appDatabaseProvider);
      await db.insertDraft(
        DraftSubmissionsCompanion.insert(
          id: draftId,
          projectId: _siteId!,
          documentType: 'social_value',
          formData: jsonEncode(formData),
          idempotencyKey: draftId,
          photoLocalPath: Value(_photoPath),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not save the entry. Please try again.')),
      );
      return;
    }

    ref.read(syncServiceProvider).syncNow();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Saved on this device. Syncing in the background.')),
    );
    context.go('/submissions');
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final value = _siteValue;
    final kpis = value?.kpis ?? const <SocialValueKpi>[];

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.resubmittedFromId != null ? 'Correct social value' : 'Social value'),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
            children: [
              Text(
                'Log jobs, pay or training delivered on this contract.',
                style: textTheme.bodyMedium?.copyWith(color: colorScheme.onSurfaceVariant),
              ),
              const SizedBox(height: 20),
              if (widget.projectId == null || widget.projectId!.isEmpty) ...[
                DropdownButtonFormField<String>(
                  value: _siteId,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Site'),
                  items: [
                    for (final s in _sites)
                      DropdownMenuItem(value: s.id, child: Text(s.label, overflow: TextOverflow.ellipsis)),
                  ],
                  onChanged: _submitting
                      ? null
                      : (id) {
                          setState(() {
                            _siteId = id;
                            _siteLabel = _sites.where((s) => s.id == id).map((s) => s.label).firstOrNull;
                          });
                          _loadKpis();
                        },
                  validator: (v) => v == null || v.isEmpty ? 'Choose a site' : null,
                ),
                const SizedBox(height: 16),
              ] else if (_siteLabel != null) ...[
                Text(_siteLabel!, style: textTheme.titleSmall),
                const SizedBox(height: 16),
              ],
              if (_loadingKpis) const LinearProgressIndicator(),
              if (_loadError != null) ...[
                Text(_loadError!, style: TextStyle(color: colorScheme.error)),
                TextButton(onPressed: _loadKpis, child: const Text('Try again')),
              ],
              if (value != null && !value.enabled)
                _Notice(
                  text: "Social value isn't included in your organisation's plan. Ask your administrator.",
                  colorScheme: colorScheme,
                )
              else if (value != null && kpis.isEmpty)
                _Notice(
                  text: value.contractName == null
                      ? 'This site is not on a contract with social value KPIs.'
                      : 'No open social value KPIs on ${value.contractName}. Ask your administrator to add them.',
                  colorScheme: colorScheme,
                )
              else if (value != null) ...[
                if (value.contractName != null) ...[
                  Text('Contract: ${value.contractName}', style: textTheme.bodySmall),
                  const SizedBox(height: 12),
                ],
                DropdownButtonFormField<String>(
                  value: _kpiId,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'KPI'),
                  items: [
                    for (final k in kpis)
                      DropdownMenuItem(
                        value: k.id,
                        child: Text(
                          k.criterion == null ? k.title : '${k.title} (${k.criterion})',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: _submitting ? null : (id) => setState(() => _kpiId = id),
                  validator: (v) => v == null || v.isEmpty ? 'Choose a KPI' : null,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _quantityController,
                  enabled: !_submitting,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
                  decoration: InputDecoration(
                    labelText: 'Quantity',
                    suffixText: _kpi?.unit,
                  ),
                  validator: (v) {
                    final n = double.tryParse((v ?? '').trim());
                    if (n == null || n <= 0) return 'Enter a number above zero';
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                InkWell(
                  onTap: _submitting ? null : _pickDate,
                  child: InputDecorator(
                    decoration: const InputDecoration(labelText: 'Date delivered'),
                    child: Text(DateFormat('d MMM yyyy').format(_date)),
                  ),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _noteController,
                  enabled: !_submitting,
                  maxLength: 500,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Note (optional)',
                    helperText: "Don't enter names or other personal details.",
                  ),
                ),
                const SizedBox(height: 16),
                Text('Evidence (optional)', style: textTheme.titleSmall),
                const SizedBox(height: 4),
                Text(
                  'A timesheet, training record or apprenticeship agreement. Cover any personal details before taking the photo.',
                  style: textTheme.bodySmall?.copyWith(color: colorScheme.onSurfaceVariant),
                ),
                const SizedBox(height: 8),
                if (_photoPath != null)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.file(File(_photoPath!), height: 180, fit: BoxFit.cover),
                  ),
                Wrap(
                  spacing: 8,
                  children: [
                    OutlinedButton.icon(
                      onPressed: _submitting ? null : () => _addPhoto(ImageSource.camera),
                      icon: const Icon(Icons.camera_alt_outlined),
                      label: Text(_photoPath == null ? 'Take photo' : 'Retake'),
                    ),
                    OutlinedButton.icon(
                      onPressed: _submitting ? null : () => _addPhoto(ImageSource.gallery),
                      icon: const Icon(Icons.photo_library_outlined),
                      label: const Text('Choose photo'),
                    ),
                    if (_photoPath != null)
                      TextButton(
                        onPressed: _submitting ? null : () => setState(() => _photoPath = null),
                        child: const Text('Remove'),
                      ),
                  ],
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: _submitting ? null : _submit,
                  icon: const Icon(Icons.check),
                  label: Text(_submitting ? 'Saving…' : 'Submit'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  final String text;
  final ColorScheme colorScheme;

  const _Notice({required this.text, required this.colorScheme});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(text),
    );
  }
}
