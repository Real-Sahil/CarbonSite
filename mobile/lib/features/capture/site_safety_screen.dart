import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
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
import 'site_safety_form.dart';

enum SiteSafetyMode { hazard, inspection }

/// Reports a hazard or near miss, or records a checklist inspection, from
/// site. Saved to SQLite first and synced like any other submission; a
/// reviewer's approval raises a corrective action (and an incident report for
/// a near miss) or records the inspection in the management system.
class SiteSafetyScreen extends ConsumerStatefulWidget {
  final SiteSafetyMode mode;
  final String? projectId;
  final String? projectLabel;
  final String? resubmittedFromId;

  const SiteSafetyScreen({
    super.key,
    required this.mode,
    this.projectId,
    this.projectLabel,
    this.resubmittedFromId,
  });

  @override
  ConsumerState<SiteSafetyScreen> createState() => _SiteSafetyScreenState();
}

class _SiteSafetyScreenState extends ConsumerState<SiteSafetyScreen> {
  static const _storage = FlutterSecureStorage();
  static const _checklistCacheKey = 'inspection_checklists';

  final _formKey = GlobalKey<FormState>();
  final _descriptionController = TextEditingController();
  final _locationController = TextEditingController();
  final _actionController = TextEditingController();
  final _picker = ImagePicker();
  final _uuid = const Uuid();

  List<Project> _sites = [];
  String? _siteId;
  String? _siteLabel;

  HazardKind? _kind;
  DateTime _date = DateTime.now();
  String? _photoPath;
  bool _submitting = false;

  List<InspectionChecklist> _checklists = [];
  bool _loadingChecklists = false;
  String? _loadError;
  String? _checklistId;
  final Map<String, InspectionResult> _results = {};
  final Map<String, TextEditingController> _notes = {};

  bool get _isInspection => widget.mode == SiteSafetyMode.inspection;

  InspectionChecklist? get _checklist {
    for (final c in _checklists) {
      if (c.id == _checklistId) return c;
    }
    return null;
  }

  @override
  void initState() {
    super.initState();
    if (widget.projectId != null && widget.projectId!.isNotEmpty) {
      _siteId = widget.projectId;
      _siteLabel = widget.projectLabel;
    } else {
      _loadSites();
    }
    if (_isInspection) _loadChecklists();
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _locationController.dispose();
    _actionController.dispose();
    for (final c in _notes.values) {
      c.dispose();
    }
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
    } catch (_) {
      if (mounted) setState(() => _loadError = 'Could not load your sites. Check your connection.');
    }
  }

  Future<void> _loadChecklists() async {
    setState(() {
      _loadingChecklists = true;
      _loadError = null;
    });
    try {
      final orgId = await _storage.read(key: 'org_id') ?? '';
      final list = await getInspectionChecklists(orgId);
      await _storage.write(key: _checklistCacheKey, value: jsonEncode([for (final c in list) c.toJson()]));
      if (!mounted) return;
      setState(() => _checklists = list);
    } catch (_) {
      // Offline: the checklists last loaded on this device.
      final cached = await _storage.read(key: _checklistCacheKey);
      if (!mounted) return;
      if (cached != null) {
        try {
          setState(() => _checklists = (jsonDecode(cached) as List)
              .whereType<Map<String, dynamic>>()
              .map(InspectionChecklist.fromJson)
              .toList());
        } catch (_) {
          setState(() => _loadError = 'Could not load the checklists. Connect and try again.');
        }
      } else {
        setState(() => _loadError = 'Could not load the checklists. Connect and try again.');
      }
    } finally {
      if (mounted) {
        setState(() {
          _loadingChecklists = false;
          if (_checklists.length == 1) _checklistId = _checklists.first.id;
        });
      }
    }
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(now.year - 1),
      lastDate: now,
    );
    if (picked != null && mounted) setState(() => _date = picked);
  }

  Future<void> _addPhoto(ImageSource source) async {
    final shot = await _picker.pickImage(source: source, imageQuality: 80, maxWidth: 2400);
    if (shot == null) return;
    final dir = await getApplicationDocumentsDirectory();
    final ext = p.extension(shot.path).isEmpty ? '.jpg' : p.extension(shot.path);
    final dest = p.join(dir.path, 'hs_${_uuid.v4()}$ext');
    await File(shot.path).copy(dest);
    if (mounted) setState(() => _photoPath = dest);
  }

  TextEditingController _noteFor(String item) => _notes.putIfAbsent(item, TextEditingController.new);

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_siteId == null) return;
    final checklist = _checklist;
    if (_isInspection) {
      if (checklist == null) return;
      if (_results.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Record a result for at least one item.')),
        );
        return;
      }
    }
    setState(() => _submitting = true);

    final Map<String, dynamic> formData = _isInspection
        ? buildInspectionFormData(
            templateId: checklist!.id,
            templateTitle: checklist.title,
            location: _locationController.text,
            inspectedOn: _date,
            items: checklist.items,
            results: _results,
            notes: {for (final e in _notes.entries) e.key: e.value.text},
            resubmittedFromId: widget.resubmittedFromId,
          )
        : buildHazardFormData(
            kind: _kind!,
            description: _descriptionController.text,
            location: _locationController.text,
            immediateAction: _actionController.text,
            observedOn: _date,
            resubmittedFromId: widget.resubmittedFromId,
          );

    final draftId = _uuid.v4();
    try {
      final db = ref.read(appDatabaseProvider);
      await db.insertDraft(
        DraftSubmissionsCompanion.insert(
          id: draftId,
          projectId: _siteId!,
          documentType: _isInspection ? 'site_inspection' : 'hazard_report',
          formData: jsonEncode(formData),
          idempotencyKey: draftId,
          photoLocalPath: Value(_photoPath),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not save. Please try again.')),
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
    final title = _isInspection ? 'Site inspection' : 'Hazard or near miss';

    return Scaffold(
      appBar: AppBar(title: Text(widget.resubmittedFromId != null ? 'Correct: $title' : title)),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
            children: [
              Text(
                _isInspection
                    ? 'Go through the checklist. Failed items become a corrective action once reviewed.'
                    : 'Report what you saw. Your supervisor reviews it and a corrective action is raised.',
                style: textTheme.bodyMedium?.copyWith(color: colorScheme.onSurfaceVariant),
              ),
              const SizedBox(height: 20),
              if (widget.projectId == null || widget.projectId!.isEmpty) ...[
                DropdownButtonFormField<String>(
                  value: _siteId,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Site'),
                  items: [
                    for (final s in _sites) DropdownMenuItem(value: s.id, child: Text(s.label, overflow: TextOverflow.ellipsis)),
                  ],
                  onChanged: _submitting
                      ? null
                      : (id) => setState(() {
                            _siteId = id;
                            _siteLabel = _sites.where((s) => s.id == id).map((s) => s.label).firstOrNull;
                          }),
                  validator: (v) => v == null || v.isEmpty ? 'Choose a site' : null,
                ),
                const SizedBox(height: 16),
              ] else if (_siteLabel != null) ...[
                Text(_siteLabel!, style: textTheme.titleSmall),
                const SizedBox(height: 16),
              ],
              if (_loadError != null) ...[
                Text(_loadError!, style: TextStyle(color: colorScheme.error)),
                if (_isInspection) TextButton(onPressed: _loadChecklists, child: const Text('Try again')),
              ],
              if (_isInspection) ..._inspectionFields(colorScheme, textTheme) else ..._hazardFields(),
              const SizedBox(height: 16),
              InkWell(
                onTap: _submitting ? null : _pickDate,
                child: InputDecorator(
                  decoration: InputDecoration(labelText: _isInspection ? 'Inspected on' : 'Seen on'),
                  child: Text(DateFormat('d MMM yyyy').format(_date)),
                ),
              ),
              const SizedBox(height: 16),
              Text('Photo (optional)', style: textTheme.titleSmall),
              const SizedBox(height: 4),
              Text(
                "Don't include people's faces or personal details.",
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
          ),
        ),
      ),
    );
  }

  List<Widget> _hazardFields() {
    return [
      DropdownButtonFormField<HazardKind>(
        value: _kind,
        isExpanded: true,
        decoration: const InputDecoration(labelText: 'What did you see?'),
        items: [
          for (final k in HazardKind.values) DropdownMenuItem(value: k, child: Text(hazardKindLabels[k]!)),
        ],
        onChanged: _submitting ? null : (k) => setState(() => _kind = k),
        validator: (v) => v == null ? 'Choose one' : null,
      ),
      const SizedBox(height: 16),
      TextFormField(
        controller: _descriptionController,
        enabled: !_submitting,
        maxLength: 2000,
        maxLines: 4,
        decoration: const InputDecoration(labelText: 'What happened or what is wrong'),
        validator: (v) => (v ?? '').trim().isEmpty ? 'Describe what you saw' : null,
      ),
      const SizedBox(height: 8),
      TextFormField(
        controller: _locationController,
        enabled: !_submitting,
        maxLength: 300,
        decoration: const InputDecoration(labelText: 'Where on site (optional)'),
      ),
      const SizedBox(height: 8),
      TextFormField(
        controller: _actionController,
        enabled: !_submitting,
        maxLength: 2000,
        maxLines: 2,
        decoration: const InputDecoration(labelText: 'What you did about it (optional)'),
      ),
    ];
  }

  List<Widget> _inspectionFields(ColorScheme colorScheme, TextTheme textTheme) {
    final checklist = _checklist;
    return [
      if (_loadingChecklists) const LinearProgressIndicator(),
      if (!_loadingChecklists && _checklists.isEmpty && _loadError == null)
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(12)),
          child: const Text('No inspection checklists are set up yet. Ask your administrator to add one in the web app.'),
        ),
      if (_checklists.isNotEmpty) ...[
        DropdownButtonFormField<String>(
          value: _checklistId,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Checklist'),
          items: [
            for (final c in _checklists) DropdownMenuItem(value: c.id, child: Text(c.title, overflow: TextOverflow.ellipsis)),
          ],
          onChanged: _submitting
              ? null
              : (id) => setState(() {
                    _checklistId = id;
                    _results.clear();
                  }),
          validator: (v) => v == null || v.isEmpty ? 'Choose a checklist' : null,
        ),
        const SizedBox(height: 16),
        TextFormField(
          controller: _locationController,
          enabled: !_submitting,
          maxLength: 300,
          decoration: const InputDecoration(labelText: 'Area inspected'),
          validator: (v) => (v ?? '').trim().isEmpty ? 'Say where you inspected' : null,
        ),
      ],
      if (checklist != null)
        for (final item in checklist.items) ...[
          const SizedBox(height: 12),
          Text(item, style: textTheme.bodyLarge),
          const SizedBox(height: 6),
          SegmentedButton<InspectionResult>(
            emptySelectionAllowed: true,
            segments: const [
              ButtonSegment(value: InspectionResult.pass, label: Text('Pass')),
              ButtonSegment(value: InspectionResult.fail, label: Text('Fail')),
              ButtonSegment(value: InspectionResult.na, label: Text('N/A')),
            ],
            selected: _results[item] == null ? <InspectionResult>{} : {_results[item]!},
            onSelectionChanged: _submitting
                ? null
                : (s) => setState(() {
                      if (s.isEmpty) {
                        _results.remove(item);
                      } else {
                        _results[item] = s.first;
                      }
                    }),
          ),
          if (_results[item] == InspectionResult.fail)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: TextField(
                controller: _noteFor(item),
                enabled: !_submitting,
                maxLength: 1000,
                decoration: const InputDecoration(labelText: 'What was wrong'),
              ),
            ),
        ],
    ];
  }
}
