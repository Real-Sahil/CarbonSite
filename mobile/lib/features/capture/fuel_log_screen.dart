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

/// Logs fuel on site: a delivery into a bowser or tank, an issue from it to a
/// machine, or a dip (the level you measured).
///
/// The site's stores and machines come from the server and are cached per
/// site, so a worker who has opened this once can log offline. The entry is
/// saved to SQLite first and synced like any other submission; a reviewer's
/// approval adds it to the store's record. It does not change the carbon
/// inventory, which counts fuel from receipts and bills.
class FuelLogScreen extends ConsumerStatefulWidget {
  final String? projectId;
  final String? projectLabel;
  final String? resubmittedFromId;

  const FuelLogScreen({
    super.key,
    this.projectId,
    this.projectLabel,
    this.resubmittedFromId,
  });

  @override
  ConsumerState<FuelLogScreen> createState() => _FuelLogScreenState();
}

class _FuelLogScreenState extends ConsumerState<FuelLogScreen> {
  static const _storage = FlutterSecureStorage();

  final _formKey = GlobalKey<FormState>();
  final _litresController = TextEditingController();
  final _fuelTypeController = TextEditingController(text: 'diesel');
  final _supplierController = TextEditingController();
  final _referenceController = TextEditingController();
  final _vehicleController = TextEditingController();
  final _meterController = TextEditingController();
  final _noteController = TextEditingController();
  final _picker = ImagePicker();
  final _uuid = const Uuid();

  List<Project> _sites = [];
  String? _siteId;
  String? _siteLabel;

  SiteFuel? _siteFuel;
  bool _loading = false;
  String? _loadError;

  String _action = 'delivery';
  String? _storeId;
  String? _machineId;
  DateTime _date = DateTime.now();
  String? _photoPath;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    if (widget.projectId != null && widget.projectId!.isNotEmpty) {
      _siteId = widget.projectId;
      _siteLabel = widget.projectLabel;
      _loadFuel();
    } else {
      _loadSites();
    }
  }

  @override
  void dispose() {
    _litresController.dispose();
    _fuelTypeController.dispose();
    _supplierController.dispose();
    _referenceController.dispose();
    _vehicleController.dispose();
    _meterController.dispose();
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
      if (_siteId != null) await _loadFuel();
    } catch (_) {
      if (mounted) {
        setState(() => _loadError = 'Could not load your sites. Check your connection.');
      }
    }
  }

  String _cacheKey(String siteId) => 'fuel_site_$siteId';

  Future<void> _loadFuel() async {
    final siteId = _siteId;
    if (siteId == null || siteId.isEmpty) return;
    setState(() {
      _loading = true;
      _loadError = null;
      _siteFuel = null;
      _storeId = null;
      _machineId = null;
    });
    try {
      final orgId = await _storage.read(key: 'org_id') ?? '';
      final value = await getSiteFuel(orgId, siteId);
      await _storage.write(key: _cacheKey(siteId), value: jsonEncode(value.toJson()));
      if (!mounted) return;
      setState(() => _siteFuel = value);
    } catch (_) {
      // Offline: fall back to the stores and machines last loaded for this site.
      final cached = await _storage.read(key: _cacheKey(siteId));
      if (!mounted) return;
      if (cached != null) {
        try {
          setState(() => _siteFuel = SiteFuel.fromJson(jsonDecode(cached) as Map<String, dynamic>));
        } catch (_) {
          setState(() => _loadError = 'Could not load the fuel stores. Connect and try again.');
        }
      } else {
        setState(() => _loadError = 'Could not load the fuel stores. Connect and try again.');
      }
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          final stores = _siteFuel?.stores ?? const <FuelStoreOption>[];
          if (stores.length == 1) _selectStore(stores.first.id);
        });
      }
    }
  }

  void _selectStore(String? id) {
    _storeId = id;
    for (final s in _siteFuel?.stores ?? const <FuelStoreOption>[]) {
      if (s.id == id) _fuelTypeController.text = s.fuelType;
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
    // Keep a copy in app storage so the draft survives the picker's temp
    // file being cleared before the sync runs.
    final dir = await getApplicationDocumentsDirectory();
    final ext = p.extension(shot.path).isEmpty ? '.jpg' : p.extension(shot.path);
    final dest = p.join(dir.path, 'fuel_${_uuid.v4()}$ext');
    await File(shot.path).copy(dest);
    if (mounted) setState(() => _photoPath = dest);
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final storeId = _storeId;
    if (_siteId == null || storeId == null) return;
    setState(() => _submitting = true);

    String? nonEmpty(TextEditingController c) => c.text.trim().isEmpty ? null : c.text.trim();
    final formData = <String, dynamic>{
      'action': _action,
      'storeId': storeId,
      'on': DateFormat('yyyy-MM-dd').format(_date),
      'litres': double.parse(_litresController.text.trim()),
      if (_action == 'delivery') 'fuelType': _fuelTypeController.text.trim(),
      if (_action == 'delivery' && nonEmpty(_supplierController) != null) 'supplierName': nonEmpty(_supplierController),
      if (_action == 'delivery' && nonEmpty(_referenceController) != null) 'reference': nonEmpty(_referenceController),
      if (_action == 'issue' && _machineId != null) 'plantAssetId': _machineId,
      if (_action == 'issue' && _machineId == null && nonEmpty(_vehicleController) != null) 'vehicleLabel': nonEmpty(_vehicleController),
      if (_action == 'issue' && nonEmpty(_meterController) != null) 'meterReading': double.tryParse(_meterController.text.trim()),
      if (nonEmpty(_noteController) != null) 'note': nonEmpty(_noteController),
      if (widget.resubmittedFromId != null) 'resubmittedFromId': widget.resubmittedFromId,
    };

    final draftId = _uuid.v4();
    try {
      final db = ref.read(appDatabaseProvider);
      await db.insertDraft(
        DraftSubmissionsCompanion.insert(
          id: draftId,
          projectId: _siteId!,
          documentType: 'fuel_log',
          formData: jsonEncode(formData),
          idempotencyKey: draftId,
          photoLocalPath: Value(_action == 'delivery' ? _photoPath : null),
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
    final fuel = _siteFuel;
    final stores = fuel?.stores ?? const <FuelStoreOption>[];
    final machines = fuel?.machines ?? const <FuelMachineOption>[];

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.resubmittedFromId != null ? 'Correct fuel log' : 'Fuel log'),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
            children: [
              Text(
                'Log fuel delivered to a bowser or tank, fuel put into a machine, or the level you measured.',
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
                          _loadFuel();
                        },
                  validator: (v) => v == null || v.isEmpty ? 'Choose a site' : null,
                ),
                const SizedBox(height: 16),
              ] else if (_siteLabel != null) ...[
                Text(_siteLabel!, style: textTheme.titleSmall),
                const SizedBox(height: 16),
              ],
              if (_loading) const LinearProgressIndicator(),
              if (_loadError != null) ...[
                Text(_loadError!, style: TextStyle(color: colorScheme.error)),
                TextButton(onPressed: _loadFuel, child: const Text('Try again')),
              ],
              if (fuel != null && stores.isEmpty)
                _Notice(
                  text: 'No bowsers or tanks are set up on this site. Ask your administrator to add them in the web app.',
                  colorScheme: colorScheme,
                )
              else if (fuel != null) ...[
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'delivery', label: Text('Delivery')),
                    ButtonSegment(value: 'issue', label: Text('Issue')),
                    ButtonSegment(value: 'dip', label: Text('Dip')),
                  ],
                  selected: {_action},
                  onSelectionChanged: _submitting ? null : (s) => setState(() => _action = s.first),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  value: _storeId,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Bowser or tank'),
                  items: [
                    for (final s in stores) DropdownMenuItem(value: s.id, child: Text(s.name, overflow: TextOverflow.ellipsis)),
                  ],
                  onChanged: _submitting ? null : (id) => setState(() => _selectStore(id)),
                  validator: (v) => v == null || v.isEmpty ? 'Choose a bowser or tank' : null,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _litresController,
                  enabled: !_submitting,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
                  decoration: InputDecoration(
                    labelText: _action == 'dip' ? 'Level measured' : 'Litres',
                    suffixText: 'L',
                    helperText: _action == 'dip' ? 'The level at the end of the day, after any fuel in or out.' : null,
                  ),
                  validator: (v) {
                    final n = double.tryParse((v ?? '').trim());
                    if (n == null) return 'Enter a number';
                    if (_action == 'dip' ? n < 0 : n <= 0) return _action == 'dip' ? 'Enter zero or more' : 'Enter a number above zero';
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                InkWell(
                  onTap: _submitting ? null : _pickDate,
                  child: InputDecorator(
                    decoration: const InputDecoration(labelText: 'Date'),
                    child: Text(DateFormat('d MMM yyyy').format(_date)),
                  ),
                ),
                const SizedBox(height: 16),
                if (_action == 'delivery') ...[
                  TextFormField(
                    controller: _fuelTypeController,
                    enabled: !_submitting,
                    maxLength: 40,
                    decoration: const InputDecoration(labelText: 'Fuel type', helperText: 'For example diesel, HVO, HVO50'),
                    validator: (v) => (v ?? '').trim().isEmpty ? 'Enter the fuel type' : null,
                  ),
                  TextFormField(
                    controller: _supplierController,
                    enabled: !_submitting,
                    maxLength: 200,
                    decoration: const InputDecoration(labelText: 'Supplier (optional)'),
                  ),
                  TextFormField(
                    controller: _referenceController,
                    enabled: !_submitting,
                    maxLength: 100,
                    decoration: const InputDecoration(labelText: 'Delivery note number (optional)'),
                  ),
                  const SizedBox(height: 8),
                  Text('Delivery note photo (optional)', style: textTheme.titleSmall),
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
                      if (_photoPath != null)
                        TextButton(
                          onPressed: _submitting ? null : () => setState(() => _photoPath = null),
                          child: const Text('Remove'),
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),
                ],
                if (_action == 'issue') ...[
                  DropdownButtonFormField<String?>(
                    value: _machineId,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Machine'),
                    items: [
                      const DropdownMenuItem<String?>(value: null, child: Text('Not in the list')),
                      for (final m in machines) DropdownMenuItem<String?>(value: m.id, child: Text(m.name, overflow: TextOverflow.ellipsis)),
                    ],
                    onChanged: _submitting ? null : (id) => setState(() => _machineId = id),
                  ),
                  if (_machineId == null)
                    TextFormField(
                      controller: _vehicleController,
                      enabled: !_submitting,
                      maxLength: 120,
                      decoration: const InputDecoration(labelText: 'Vehicle or machine name', helperText: 'For example hired van, AB12 CDE'),
                      validator: (v) => _machineId == null && (v ?? '').trim().isEmpty ? 'Name what took the fuel' : null,
                    ),
                  TextFormField(
                    controller: _meterController,
                    enabled: !_submitting,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
                    decoration: const InputDecoration(labelText: 'Hours or odometer (optional)'),
                  ),
                  const SizedBox(height: 16),
                ],
                TextFormField(
                  controller: _noteController,
                  enabled: !_submitting,
                  maxLength: 500,
                  maxLines: 2,
                  decoration: const InputDecoration(labelText: 'Note (optional)'),
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
