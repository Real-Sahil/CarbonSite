import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

import '../../core/storage/app_database.dart';
import '../sync/sync_service.dart';
import 'barcode_scan_screen.dart';
import 'ocr_extractor.dart';

/// Field evidence capture flow:
///
/// 1. Pick document type (grid)
/// 2. Photograph the document (camera via image_picker)
/// 3. On-device ML Kit OCR pre-fills the form (auto fields marked)
/// 4. Review/correct, optional GPS tag, submit
/// 5. Draft saved to SQLite first — sync service uploads in background
class CaptureScreen extends ConsumerStatefulWidget {
  final String? projectId;
  final String? projectLabel;

  const CaptureScreen({super.key, this.projectId, this.projectLabel});

  @override
  ConsumerState<CaptureScreen> createState() => _CaptureScreenState();
}

enum _CaptureStep { selectType, review }

class _CaptureScreenState extends ConsumerState<CaptureScreen> {
  final _picker = ImagePicker();
  final _uuid = const Uuid();
  final _formKey = GlobalKey<FormState>();

  _CaptureStep _step = _CaptureStep.selectType;
  DocumentType? _documentType;
  String? _photoPath;
  bool _processingPhoto = false;
  bool _gpsEnabled = true;
  bool _submitting = false;

  /// Field keys auto-filled by OCR — rendered with a sparkle marker.
  final Set<String> _autoFilled = {};

  final Map<String, TextEditingController> _controllers = {};

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  TextEditingController _controller(String key) {
    return _controllers.putIfAbsent(key, TextEditingController.new);
  }

  // ---------------------------------------------------------------------
  // Step 1 -> 2: type chosen, take photo, run OCR
  // ---------------------------------------------------------------------

  Future<void> _onTypeSelected(DocumentType type) async {
    setState(() => _documentType = type);

    final source = await _pickImageSource();
    if (!mounted) return;

    await _takePhoto(initial: true, source: source);
  }

  /// Shows a bottom sheet asking how the user wants to provide the image.
  /// Returns null if the sheet is dismissed without a selection.
  Future<ImageSource?> _pickImageSource() async {
    return showModalBottomSheet<ImageSource>(
      context: context,
      showDragHandle: true,
      builder: (ctx) {
        final colorScheme = Theme.of(ctx).colorScheme;
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: Icon(Icons.camera_alt_outlined,
                    color: colorScheme.onSurface),
                title: const Text('Take Photo'),
                onTap: () => Navigator.of(ctx).pop(ImageSource.camera),
              ),
              ListTile(
                leading: Icon(Icons.photo_library_outlined,
                    color: colorScheme.onSurface),
                title: const Text('Photo Library'),
                onTap: () => Navigator.of(ctx).pop(ImageSource.gallery),
              ),
              ListTile(
                leading: Icon(Icons.folder_outlined,
                    color: colorScheme.onSurface),
                title: const Text('Choose File'),
                onTap: () => Navigator.of(ctx).pop(ImageSource.gallery),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _takePhoto({
    bool initial = false,
    ImageSource? source,
  }) async {
    final imageSource = source ?? ImageSource.camera;
    XFile? picked;
    try {
      picked = await _picker.pickImage(
        source: imageSource,
        maxWidth: 2400,
        imageQuality: 85,
      );
    } catch (_) {
      picked = null; // camera/gallery unavailable (e.g. emulator) — manual entry
    }

    if (!mounted) return;

    if (picked == null) {
      if (initial) {
        // User cancelled the camera but already chose a type — let them
        // fill the form manually rather than dead-ending.
        setState(() => _step = _CaptureStep.review);
      }
      return;
    }

    setState(() => _processingPhoto = true);

    String savedPath = picked.path;
    try {
      // Copy out of the picker's temp cache so the evidence survives until
      // the background sync uploads it.
      final dir = await getApplicationDocumentsDirectory();
      final ext = p.extension(picked.path).isEmpty ? '.jpg' : p.extension(picked.path);
      savedPath = p.join(dir.path, 'evidence_${_uuid.v4()}$ext');
      await File(picked.path).copy(savedPath);
    } catch (_) {
      savedPath = picked.path;
    }

    await _runOcr(savedPath);

    if (!mounted) return;
    setState(() {
      _photoPath = savedPath;
      _processingPhoto = false;
      _step = _CaptureStep.review;
    });
  }

  Future<void> _runOcr(String imagePath) async {
    final type = _documentType ?? DocumentType.other;
    String rawText = '';
    try {
      final recognizer = TextRecognizer(script: TextRecognitionScript.latin);
      try {
        final result =
            await recognizer.processImage(InputImage.fromFilePath(imagePath));
        rawText = result.text;
      } finally {
        await recognizer.close();
      }
    } catch (_) {
      return; // OCR unavailable — form stays blank, user types values
    }
    if (rawText.trim().isEmpty) return;

    final fields = OcrExtractor.extract(rawText, type);
    _applyExtracted(fields);
  }

  void _applyExtracted(ExtractedFields fields) {
    _autoFilled.clear();
    void apply(String key, String? value) {
      if (value == null || value.isEmpty) return;
      _controller(key).text = value;
      _autoFilled.add(key);
    }

    apply('weight', fields.weight);
    apply('weightUnit', fields.weightUnit);
    apply('ewcCode', fields.ewcCode);
    apply('date', fields.date);
    apply('vehicleReg', fields.vehicleReg);
    apply('supplierName', fields.supplierName);
    apply('fuelType', fields.fuelType);
    apply('volume', fields.volume);
    apply('volumeUnit', fields.volumeUnit);
  }

  // ---------------------------------------------------------------------
  // Submit: SQLite first, background sync second
  // ---------------------------------------------------------------------

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _submitting = true);

    double? gpsLat;
    double? gpsLng;
    if (_gpsEnabled) {
      final position = await _tryGetPosition();
      gpsLat = position?.latitude;
      gpsLng = position?.longitude;
    }

    final formData = <String, dynamic>{};
    _controllers.forEach((key, controller) {
      final value = controller.text.trim();
      if (value.isNotEmpty) formData[key] = value;
    });
    formData['autoExtracted'] = _autoFilled.toList();

    final draftId = _uuid.v4();
    final type = _documentType ?? DocumentType.other;

    try {
      final db = ref.read(appDatabaseProvider);
      await db.insertDraft(
        DraftSubmissionsCompanion.insert(
          id: draftId,
          projectId: widget.projectId ?? '',
          documentType: _documentTypeApiValue(type),
          formData: jsonEncode(formData),
          idempotencyKey: draftId,
          photoLocalPath: Value(_photoPath),
          gpsLat: Value(gpsLat),
          gpsLng: Value(gpsLng),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not save the submission. Please try again.'),
        ),
      );
      return;
    }

    // Fire-and-forget: drains immediately when online, otherwise the
    // connectivity listener picks the draft up later.
    ref.read(syncServiceProvider).syncNow();

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Saved on this device. Syncing in the background.'),
      ),
    );
    context.go('/submissions');
  }

  Future<Position?> _tryGetPosition() async {
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return null;
      }
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 10),
        ),
      );
    } catch (_) {
      return null; // GPS is best-effort, never blocks submission
    }
  }

  String _documentTypeApiValue(DocumentType type) {
    switch (type) {
      case DocumentType.wasteTicket:
        return 'waste_ticket';
      case DocumentType.deliveryNote:
        return 'delivery_note';
      case DocumentType.fuelReceipt:
        return 'fuel_receipt';
      case DocumentType.other:
        return 'other';
    }
  }

  // ---------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          _step == _CaptureStep.selectType
              ? 'Capture Document'
              : _documentTypeLabel(_documentType ?? DocumentType.other),
        ),
        leading: _step == _CaptureStep.review
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                tooltip: 'Back to document type',
                onPressed: _submitting
                    ? null
                    : () => setState(() => _step = _CaptureStep.selectType),
              )
            : null,
      ),
      body: _processingPhoto
          ? const _OcrProgress()
          : switch (_step) {
              _CaptureStep.selectType => _buildTypeGrid(colorScheme),
              _CaptureStep.review => _buildReviewForm(colorScheme),
            },
    );
  }

  Widget _buildTypeGrid(ColorScheme colorScheme) {
    final textTheme = Theme.of(context).textTheme;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (widget.projectLabel != null &&
                widget.projectLabel!.isNotEmpty) ...[
              Text(
                widget.projectLabel!,
                style: textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 4),
            ],
            Text(
              'What are you photographing?',
              style: textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'The form is pre-filled automatically from the photo.',
              style: textTheme.bodyMedium?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 20),
            Expanded(
              child: GridView.count(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.05,
                children: [
                  _TypeCard(
                    icon: Icons.delete_outline,
                    label: 'Waste Ticket',
                    caption: 'Transfer & consignment notes',
                    onTap: () => _onTypeSelected(DocumentType.wasteTicket),
                  ),
                  _TypeCard(
                    icon: Icons.local_shipping_outlined,
                    label: 'Delivery Note',
                    caption: 'Materials in & out',
                    onTap: () => _onTypeSelected(DocumentType.deliveryNote),
                  ),
                  _TypeCard(
                    icon: Icons.local_gas_station_outlined,
                    label: 'Fuel Receipt',
                    caption: 'Diesel, gas oil, AdBlue',
                    onTap: () => _onTypeSelected(DocumentType.fuelReceipt),
                  ),
                  _TypeCard(
                    icon: Icons.description_outlined,
                    label: 'Other',
                    caption: 'Any other evidence',
                    onTap: () => _onTypeSelected(DocumentType.other),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReviewForm(ColorScheme colorScheme) {
    final textTheme = Theme.of(context).textTheme;
    final type = _documentType ?? DocumentType.other;

    return SafeArea(
      child: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          children: [
            _PhotoCard(
              photoPath: _photoPath,
              onRetake: _submitting
                  ? null
                  : () async {
                      final source = await _pickImageSource();
                      if (!mounted) return;
                      await _takePhoto(source: source);
                    },
            ),
            const SizedBox(height: 16),
            if (_autoFilled.isNotEmpty) ...[
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    Icon(Icons.auto_awesome,
                        size: 16, color: colorScheme.onPrimaryContainer),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Fields marked with a sparkle were read from the '
                        'photo. Please check them.',
                        style: textTheme.bodySmall?.copyWith(
                          color: colorScheme.onPrimaryContainer,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],
            ..._fieldsForType(type),
            const SizedBox(height: 8),
            SwitchListTile(
              value: _gpsEnabled,
              onChanged: _submitting
                  ? null
                  : (v) => setState(() => _gpsEnabled = v),
              title: const Text('Attach GPS location'),
              subtitle: const Text('Tags the submission with this site'),
              secondary: const Icon(Icons.location_on_outlined),
              contentPadding: EdgeInsets.zero,
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _submitting ? null : _submit,
              icon: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.cloud_upload_outlined),
              label: Text(_submitting ? 'Saving…' : 'Submit'),
            ),
            const SizedBox(height: 8),
            Text(
              'Works offline. Saved on this device first, then synced.',
              style: textTheme.bodySmall?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _fieldsForType(DocumentType type) {
    switch (type) {
      case DocumentType.wasteTicket:
        return [
          _field('weight', 'Weight', hint: 'e.g. 2.5',
              keyboard: TextInputType.number, requiredField: true),
          _unitField('weightUnit', const ['kg', 'tonnes']),
          _field('ewcCode', 'EWC code', hint: 'e.g. 17 01 01'),
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: OutlinedButton.icon(
              icon: const Icon(Icons.qr_code_scanner),
              label: const Text('Scan Barcode'),
              onPressed: _submitting
                  ? null
                  : () async {
                      final code = await Navigator.push<String>(
                        context,
                        MaterialPageRoute(
                          builder: (_) => BarcodeScanScreen(
                            onDetected: (c) => c,
                          ),
                        ),
                      );
                      if (code != null && code.isNotEmpty) {
                        _controller('ewcCode').text = code;
                        setState(() => _autoFilled.remove('ewcCode'));
                      }
                    },
            ),
          ),
          _field('date', 'Document date', hint: 'e.g. 12/06/2026'),
          _field('vehicleReg', 'Vehicle registration', hint: 'e.g. AB12 CDE'),
          _field('supplierName', 'Carrier / supplier'),
          _field('notes', 'Notes', maxLines: 3),
        ];
      case DocumentType.deliveryNote:
        return [
          _field('materialType', 'Material', hint: 'e.g. Concrete blocks',
              requiredField: true),
          _field('weight', 'Quantity / weight', hint: 'e.g. 1250',
              keyboard: TextInputType.number),
          _unitField('weightUnit', const ['kg', 'tonnes']),
          _field('date', 'Delivery date', hint: 'e.g. 12/06/2026'),
          _field('vehicleReg', 'Vehicle registration', hint: 'e.g. AB12 CDE'),
          _field('supplierName', 'Supplier'),
          _field('notes', 'Notes', maxLines: 3),
        ];
      case DocumentType.fuelReceipt:
        return [
          _field('fuelType', 'Fuel type', hint: 'e.g. diesel', requiredField: true),
          _field('volume', 'Volume (litres)', hint: 'e.g. 42.5',
              keyboard: TextInputType.number, requiredField: true),
          _field('date', 'Receipt date', hint: 'e.g. 12/06/2026'),
          _field('vehicleReg', 'Vehicle / plant registration'),
          _field('supplierName', 'Supplier / forecourt'),
          _field('notes', 'Notes', maxLines: 3),
        ];
      case DocumentType.other:
        return [
          _field('description', 'Description', requiredField: true, maxLines: 2),
          _field('date', 'Document date', hint: 'e.g. 12/06/2026'),
          _field('supplierName', 'Company on document'),
          _field('notes', 'Notes', maxLines: 3),
        ];
    }
  }

  Widget _field(
    String key,
    String label, {
    String? hint,
    TextInputType? keyboard,
    bool requiredField = false,
    int maxLines = 1,
  }) {
    final auto = _autoFilled.contains(key);
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextFormField(
        controller: _controller(key),
        keyboardType: keyboard,
        maxLines: maxLines,
        enabled: !_submitting,
        onChanged: (_) {
          // Once the user edits an auto value it is theirs, drop the marker.
          if (auto) setState(() => _autoFilled.remove(key));
        },
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          helperText: auto ? 'Auto-filled from photo' : null,
          suffixIcon: auto
              ? Tooltip(
                  message: 'Read automatically from the photo',
                  child: Icon(
                    Icons.auto_awesome,
                    size: 18,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                )
              : null,
        ),
        validator: requiredField
            ? (value) => (value == null || value.trim().isEmpty)
                ? '$label is required'
                : null
            : null,
      ),
    );
  }

  Widget _unitField(String key, List<String> units) {
    final controller = _controller(key);
    final current = units.contains(controller.text) ? controller.text : null;
    final auto = _autoFilled.contains(key);
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: DropdownButtonFormField<String>(
        // Use a key so OCR re-runs (retake) rebuild the initial value.
        key: ValueKey('$key-${controller.text}'),
        value: current,
        items: units
            .map((u) => DropdownMenuItem(value: u, child: Text(u)))
            .toList(),
        onChanged: _submitting
            ? null
            : (value) {
                controller.text = value ?? '';
                if (auto) setState(() => _autoFilled.remove(key));
              },
        decoration: InputDecoration(
          labelText: 'Unit',
          helperText: auto ? 'Auto-filled from photo' : null,
          suffixIcon: auto
              ? Icon(
                  Icons.auto_awesome,
                  size: 18,
                  color: Theme.of(context).colorScheme.primary,
                )
              : null,
        ),
      ),
    );
  }

  String _documentTypeLabel(DocumentType type) {
    switch (type) {
      case DocumentType.wasteTicket:
        return 'Waste Ticket';
      case DocumentType.deliveryNote:
        return 'Delivery Note';
      case DocumentType.fuelReceipt:
        return 'Fuel Receipt';
      case DocumentType.other:
        return 'Other Document';
    }
  }
}

// -----------------------------------------------------------------------------
// Pieces
// -----------------------------------------------------------------------------

class _TypeCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String caption;
  final VoidCallback onTap;

  const _TypeCard({
    required this.icon,
    required this.label,
    required this.caption,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Material(
      color: colorScheme.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: colorScheme.outlineVariant),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: colorScheme.primary, size: 24),
              ),
              const Spacer(),
              Text(
                label,
                style: textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                caption,
                style: textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PhotoCard extends StatelessWidget {
  final String? photoPath;
  final VoidCallback? onRetake;

  const _PhotoCard({required this.photoPath, required this.onRetake});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    if (photoPath == null) {
      return OutlinedButton.icon(
        onPressed: onRetake,
        icon: const Icon(Icons.camera_alt_outlined),
        label: const Text('Add photo'),
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
        ),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: Stack(
        children: [
          AspectRatio(
            aspectRatio: 16 / 10,
            child: Image.file(
              File(photoPath!),
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                color: colorScheme.surfaceContainerHighest,
                alignment: Alignment.center,
                child: Icon(
                  Icons.broken_image_outlined,
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          ),
          Positioned(
            right: 8,
            bottom: 8,
            child: FilledButton.tonalIcon(
              onPressed: onRetake,
              icon: const Icon(Icons.camera_alt_outlined, size: 16),
              label: Text('Retake', style: textTheme.labelMedium),
              style: FilledButton.styleFrom(
                minimumSize: Size.zero,
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OcrProgress extends StatelessWidget {
  const _OcrProgress();

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: 20),
          Text(
            'Reading document…',
            style: textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Extracting weights, codes and dates on-device',
            style: textTheme.bodySmall?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}
