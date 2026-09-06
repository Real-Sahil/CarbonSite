import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

import '../../core/api/endpoints.dart';
import '../../core/storage/app_database.dart';
import '../sync/sync_service.dart';
import 'barcode_scan_screen.dart';
import 'gps_location_map.dart';
import 'ocr_extractor.dart';
import 'ocr_validation_panel.dart';

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

  /// When non-null this is a correction re-submission.  The ID is included
  /// in the POST body sent to the field-submissions API so the server can
  /// link the new submission back to the rejected original.
  final String? resubmittedFromId;

  /// Pre-selected document type when arriving from a resubmission flow.
  final String? documentType;

  const CaptureScreen({
    super.key,
    this.projectId,
    this.projectLabel,
    this.resubmittedFromId,
    this.documentType,
  });

  @override
  ConsumerState<CaptureScreen> createState() => _CaptureScreenState();
}

enum _CaptureStep { selectType, review }

class _CaptureScreenState extends ConsumerState<CaptureScreen> {
  static const _storage = FlutterSecureStorage();

  final _picker = ImagePicker();
  final _uuid = const Uuid();
  final _formKey = GlobalKey<FormState>();

  _CaptureStep _step = _CaptureStep.selectType;
  DocumentType? _documentType;
  String? _photoPath;
  bool _processingPhoto = false;
  bool _gpsEnabled = true;
  bool _submitting = false;

  /// Site the submission is filed against. Server-side siteId is REQUIRED
  /// for new submissions — a draft without one can never sync. Seeded from
  /// the navigation parameter, otherwise picked in-screen.
  String? _selectedSiteId;
  String? _selectedSiteLabel;
  List<Project> _siteOptions = [];
  bool _loadingSites = false;

  /// Field keys auto-filled by OCR — rendered with a sparkle marker.
  final Set<String> _autoFilled = {};

  /// Per-field OCR confidence scores from the last extraction.
  Map<String, double> _fieldConfidence = {};

  /// Original OCR-extracted values before any user correction.
  /// Sent to the server as ocrExtractedData so reviewers can compare
  /// what OCR read from the photo vs what the field worker confirmed.
  Map<String, String> _ocrExtracted = {};

  /// SHA-256 hex digest of the captured photo bytes, computed immediately
  /// after capture. Re-verified just before submit to detect substitution.
  String? _photoHash;

  /// GPS coordinates fetched at photo-capture time to show the map preview
  /// on the review form. Separate from submit-time position so the map
  /// renders without waiting for the submit button.
  double? _capturedLat;
  double? _capturedLng;

  /// Debounce timer for real-time field format validation.
  Timer? _validationDebounce;

  /// Per-field validation error messages shown inline (null = no error).
  final Map<String, String?> _fieldErrors = {};

  final Map<String, TextEditingController> _controllers = {};

  bool get _isResubmission => widget.resubmittedFromId != null;

  /// The picker renders whenever the screen was opened without a site.
  /// Resubmissions inherit the site from the original server-side.
  bool get _showSitePicker =>
      !_isResubmission &&
      (widget.projectId == null || widget.projectId!.isEmpty);

  /// True while no site has been chosen — blocks submission of new drafts.
  bool get _needsSitePicker =>
      !_isResubmission && (_selectedSiteId == null || _selectedSiteId!.isEmpty);

  @override
  void initState() {
    super.initState();
    // If arriving from a resubmission, pre-select the document type.
    if (widget.documentType != null) {
      _documentType = _documentTypeFromApiValue(widget.documentType!);
    }
    if (widget.projectId != null && widget.projectId!.isNotEmpty) {
      _selectedSiteId = widget.projectId;
      _selectedSiteLabel = widget.projectLabel;
    } else if (!_isResubmission) {
      _loadSiteOptions();
    }
  }

  Future<void> _loadSiteOptions() async {
    setState(() => _loadingSites = true);
    try {
      final orgId = await _storage.read(key: 'org_id') ?? '';
      if (orgId.isEmpty) return;
      final sites = await getProjects(orgId);
      if (!mounted) return;
      setState(() {
        _siteOptions = sites;
        // A worker with exactly one site never needs to choose.
        if (sites.length == 1) {
          _selectedSiteId = sites.first.id;
          _selectedSiteLabel = sites.first.label;
        }
      });
    } catch (_) {
      // Offline or error — the picker shows a retry affordance.
    } finally {
      if (mounted) setState(() => _loadingSites = false);
    }
  }

  @override
  void dispose() {
    _validationDebounce?.cancel();
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  /// Returns an inline format error for the given field value, or null if valid.
  String? _validateFieldFormat(String key, String value) {
    if (value.trim().isEmpty) return null; // required check is handled by validator
    switch (key) {
      case 'ewcCode':
        // Accept: 01 01 01 / 010101 / 01*01*01 — chapter 01-20, two sub-codes
        final clean = value.replaceAll(RegExp(r'[\s*]'), '');
        if (!RegExp(r'^(0[1-9]|1[0-9]|20)\d{4}$').hasMatch(clean)) {
          return 'Use format XX XX XX (e.g. 17 04 05)';
        }
        break;
      case 'vehicleReg':
        // UK plates: current AB12 CDE, prefix P123 XYZ, suffix ABC 123D
        final reg = value.replaceAll(' ', '').toUpperCase();
        final current = RegExp(r'^[A-Z]{2}\d{2}[A-Z]{3}$');
        final prefix = RegExp(r'^[A-Z]\d{1,3}[A-Z]{3}$');
        final suffix = RegExp(r'^[A-Z]{3}\d{1,3}[A-Z]$');
        if (!current.hasMatch(reg) && !prefix.hasMatch(reg) && !suffix.hasMatch(reg)) {
          return 'Check registration format (e.g. AB12 CDE)';
        }
        break;
      case 'date':
        // Accept dd/mm/yyyy or dd-mm-yyyy or yyyy-mm-dd
        final datePatterns = [
          RegExp(r'^\d{1,2}[/\-]\d{1,2}[/\-]\d{4}$'),
          RegExp(r'^\d{4}[/\-]\d{1,2}[/\-]\d{1,2}$'),
        ];
        if (!datePatterns.any((p) => p.hasMatch(value.trim()))) {
          return 'Use date format dd/mm/yyyy';
        }
        break;
      case 'weight':
      case 'volume':
      case 'quantity':
        if (double.tryParse(value.trim()) == null) {
          return 'Enter a number';
        }
        break;
    }
    return null;
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

    // Let the worker trim out anything that could throw off OCR (other
    // tickets in frame, a hand, glare on the edge) before extraction runs.
    savedPath = await _cropPhoto(savedPath);

    // Compute photo hash before OCR so it's available for submit verification.
    _photoHash = await _computePhotoHash(savedPath);

    // Pre-fetch GPS for the map preview on the review form (best-effort).
    if (_gpsEnabled) {
      final pos = await _tryGetPosition();
      if (pos != null) {
        _capturedLat = pos.latitude;
        _capturedLng = pos.longitude;
      }
    }

    await _runOcr(savedPath);

    if (!mounted) return;
    setState(() {
      _photoPath = savedPath;
      _processingPhoto = false;
      _step = _CaptureStep.review;
    });
  }

  /// Opens the native crop UI so the field worker can trim out anything in
  /// the frame that could confuse OCR. Returns the original path unchanged
  /// if the user cancels or the crop UI is unavailable.
  Future<String> _cropPhoto(String sourcePath) async {
    try {
      final cropped = await ImageCropper().cropImage(
        sourcePath: sourcePath,
        compressQuality: 85,
        uiSettings: [
          AndroidUiSettings(
            toolbarTitle: 'Crop photo',
            toolbarColor: Colors.black,
            toolbarWidgetColor: Colors.white,
            backgroundColor: Colors.black,
            lockAspectRatio: false,
          ),
          IOSUiSettings(title: 'Crop photo'),
        ],
      );
      if (cropped == null) return sourcePath; // user cancelled

      // image_cropper writes its output to the OS cache directory, which
      // can be cleared before background sync uploads the photo — copy it
      // into the same documents directory the rest of the flow uses so it
      // survives until the draft is submitted.
      final dir = await getApplicationDocumentsDirectory();
      final ext =
          p.extension(cropped.path).isEmpty ? '.jpg' : p.extension(cropped.path);
      final persisted = p.join(dir.path, 'evidence_${_uuid.v4()}$ext');
      await File(cropped.path).copy(persisted);
      return persisted;
    } catch (_) {
      return sourcePath; // cropping unavailable — keep the uncropped photo
    }
  }

  /// Re-crops the already-captured photo from the review screen. Unlike the
  /// initial crop in [_takePhoto], this replaces a photo OCR has already run
  /// against, so the hash and extracted fields must be refreshed too.
  Future<void> _editCrop() async {
    if (_photoPath == null) return;
    setState(() => _processingPhoto = true);

    final cropped = await _cropPhoto(_photoPath!);
    _photoHash = await _computePhotoHash(cropped);
    await _runOcr(cropped);

    if (!mounted) return;
    setState(() {
      _photoPath = cropped;
      _processingPhoto = false;
    });
  }

  /// SHA-256 of the photo file. Returns null if the file can't be read.
  Future<String?> _computePhotoHash(String imagePath) async {
    try {
      final bytes = await File(imagePath).readAsBytes();
      return sha256.convert(bytes).toString();
    } catch (_) {
      return null;
    }
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
    _fieldConfidence = Map<String, double>.from(fields.fieldConfidence);
    _ocrExtracted = {};

    void apply(String key, String? value) {
      if (value == null || value.isEmpty) return;
      _controller(key).text = value;
      _autoFilled.add(key);
      // Snapshot the raw OCR value before any user correction.
      _ocrExtracted[key] = value;
    }

    apply('weight', fields.weight);
    apply('weightUnit', fields.weightUnit);
    apply('ewcCode', fields.ewcCode);
    apply('date', fields.date);
    apply('vehicleReg', fields.vehicleReg);
    apply('supplierName', fields.supplierName);
    apply('materialType', fields.materialType);
    apply('quantity', fields.quantity);
    apply('quantityUnit', fields.quantityUnit);
    apply('fuelType', fields.fuelType);
    apply('volume', fields.volume);
    apply('volumeUnit', fields.volumeUnit);
    apply('postcode', fields.postcode);
    apply('pickupPostcode', fields.pickupPostcode);
    apply('deliveryPostcode', fields.deliveryPostcode);
  }

  // ---------------------------------------------------------------------
  // Submit: SQLite first, background sync second
  // ---------------------------------------------------------------------

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    // A new submission without a site is guaranteed to be rejected by the
    // server (siteId is required) — block here instead of stranding a draft.
    if (_needsSitePicker) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Choose a site before submitting. If none are listed, '
              'ask your administrator for site access.'),
        ),
      );
      return;
    }
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

    // Embed the raw OCR snapshot so the server can split it into ocrExtractedData.
    // Using a namespaced key avoids colliding with real form fields.
    if (_ocrExtracted.isNotEmpty) {
      formData['__ocrExtracted__'] = Map<String, dynamic>.from(_ocrExtracted);
    }

    // Include the resubmission link if this is a correction.
    if (widget.resubmittedFromId != null) {
      formData['resubmittedFromId'] = widget.resubmittedFromId;
    }

    // Verify that the photo on disk still matches the hash computed at capture
    // time — detects accidental or malicious substitution before upload.
    if (_photoPath != null && _photoHash != null) {
      final currentHash = await _computePhotoHash(_photoPath!);
      if (currentHash != _photoHash) {
        if (!mounted) return;
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Photo may have been modified. Please retake the photo.',
            ),
          ),
        );
        return;
      }
      formData['__photoHash__'] = _photoHash;
    }

    final draftId = _uuid.v4();
    final type = _documentType ?? DocumentType.other;

    try {
      final db = ref.read(appDatabaseProvider);
      await db.insertDraft(
        DraftSubmissionsCompanion.insert(
          id: draftId,
          projectId: _selectedSiteId ?? '',
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
      case DocumentType.waterMeterReading:
        return 'water_meter_reading';
      case DocumentType.other:
        return 'other';
    }
  }

  DocumentType _documentTypeFromApiValue(String value) {
    switch (value) {
      case 'waste_ticket':
        return DocumentType.wasteTicket;
      case 'delivery_note':
        return DocumentType.deliveryNote;
      case 'fuel_receipt':
        return DocumentType.fuelReceipt;
      case 'water_meter_reading':
        return DocumentType.waterMeterReading;
      default:
        return DocumentType.other;
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
              ? (widget.resubmittedFromId != null
                  ? 'Submit Correction'
                  : 'Capture Document')
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
            if (!_showSitePicker &&
                _selectedSiteLabel != null &&
                _selectedSiteLabel!.isNotEmpty) ...[
              Text(
                _selectedSiteLabel!,
                style: textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 4),
            ],
            if (_showSitePicker) ...[
              _buildSitePicker(colorScheme, textTheme),
              const SizedBox(height: 16),
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
                    icon: Icons.water_drop_outlined,
                    label: 'Water Meter',
                    caption: 'Withdrawal / consumption reading',
                    onTap: () => _onTypeSelected(DocumentType.waterMeterReading),
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

  /// Shown when the capture flow was opened without a site (e.g. from the
  /// dashboard quick action). Submissions must be filed against a site.
  Widget _buildSitePicker(ColorScheme colorScheme, TextTheme textTheme) {
    if (_loadingSites) {
      return const LinearProgressIndicator();
    }
    if (_siteOptions.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Icon(Icons.info_outline, size: 18, color: colorScheme.onSurfaceVariant),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'No sites available. Connect to the internet, or ask your '
                'administrator for site access.',
                style: textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
            ),
            TextButton(onPressed: _loadSiteOptions, child: const Text('Retry')),
          ],
        ),
      );
    }
    return DropdownButtonFormField<String>(
      value: _selectedSiteId != null &&
              _siteOptions.any((s) => s.id == _selectedSiteId)
          ? _selectedSiteId
          : null,
      items: _siteOptions
          .map((s) => DropdownMenuItem(
                value: s.id,
                child: Text(s.label, overflow: TextOverflow.ellipsis),
              ))
          .toList(),
      onChanged: (value) {
        String? label;
        for (final site in _siteOptions) {
          if (site.id == value) {
            label = site.label;
            break;
          }
        }
        setState(() {
          _selectedSiteId = value;
          _selectedSiteLabel = label;
        });
      },
      decoration: const InputDecoration(
        labelText: 'Site',
        helperText: 'Which site is this document for?',
        prefixIcon: Icon(Icons.location_city_outlined),
        border: OutlineInputBorder(),
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
              onCrop: _submitting ? null : _editCrop,
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
            const SizedBox(height: 12),
            OcrValidationPanel(
              fieldConfidence: _fieldConfidence,
              autoFilledFields: _autoFilled,
            ),
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
            if (_gpsEnabled && _capturedLat != null && _capturedLng != null) ...[
              const SizedBox(height: 8),
              GpsLocationMap(lat: _capturedLat!, lng: _capturedLng!),
            ],
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
          _field('postcode', 'Site postcode', hint: 'e.g. SW1A 1AA'),
          _field('notes', 'Notes', maxLines: 3),
        ];
      case DocumentType.deliveryNote:
        return [
          _field('materialType', 'Material', hint: 'e.g. Concrete blocks',
              requiredField: true),
          _field('quantity', 'Quantity', hint: 'e.g. 1250',
              keyboard: TextInputType.number),
          _unitField('quantityUnit', const ['kg', 'tonnes', 'units', 'm3']),
          _field('date', 'Delivery date', hint: 'e.g. 12/06/2026'),
          _field('vehicleReg', 'Vehicle registration', hint: 'e.g. AB12 CDE'),
          _field('supplierName', 'Supplier'),
          _field('postcode', 'Delivery postcode', hint: 'e.g. SW1A 1AA'),
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
      case DocumentType.waterMeterReading:
        return [
          _field('meterId', 'Meter ID / serial', requiredField: true),
          _field('reading', 'Reading', hint: 'e.g. 1250.5',
              keyboard: TextInputType.number, requiredField: true),
          _unitField('readingUnit', const ['m3', 'litres']),
          _field('date', 'Reading date', hint: 'e.g. 12/06/2026'),
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
    final confidence = _fieldConfidence[key] ?? 0.0;
    final isHighConfidence = auto && confidence >= 0.85;

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextFormField(
        controller: _controller(key),
        keyboardType: keyboard,
        maxLines: maxLines,
        enabled: !_submitting,
        style: isHighConfidence
            ? TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)
            : null,
        onChanged: (value) {
          // Once the user edits an auto value it is theirs, drop the marker.
          if (auto) setState(() => _autoFilled.remove(key));
          // Debounced format validation: waits 400ms after the user stops
          // typing before running the pattern check to avoid jitter.
          _validationDebounce?.cancel();
          _validationDebounce = Timer(const Duration(milliseconds: 400), () {
            final err = _validateFieldFormat(key, value);
            if (mounted) setState(() => _fieldErrors[key] = err);
          });
        },
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          errorText: _fieldErrors[key],
          helperText: _fieldErrors[key] == null && auto
              ? 'Auto-filled from photo'
              : null,
          suffixIcon: auto
              ? Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _ConfidenceDot(confidence: confidence),
                    const SizedBox(width: 4),
                    Tooltip(
                      message: 'Read automatically from the photo',
                      child: Icon(
                        Icons.auto_awesome,
                        size: 18,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
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
    final confidence = _fieldConfidence[key] ?? 0.0;
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
              ? Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _ConfidenceDot(confidence: confidence),
                    const SizedBox(width: 4),
                    Icon(
                      Icons.auto_awesome,
                      size: 18,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(width: 8),
                  ],
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
      case DocumentType.waterMeterReading:
        return 'Water Meter Reading';
      case DocumentType.other:
        return 'Other Document';
    }
  }
}

// -----------------------------------------------------------------------------
// Confidence indicator dot
// -----------------------------------------------------------------------------

class _ConfidenceDot extends StatelessWidget {
  final double confidence;

  const _ConfidenceDot({required this.confidence});

  @override
  Widget build(BuildContext context) {
    final Color color;
    if (confidence >= 0.85) {
      color = Colors.green;
    } else if (confidence >= 0.5) {
      color = Colors.orange;
    } else {
      color = Colors.red;
    }

    return Container(
      width: 8,
      height: 8,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color,
      ),
    );
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
  final VoidCallback? onCrop;

  const _PhotoCard({
    required this.photoPath,
    required this.onRetake,
    required this.onCrop,
  });

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
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                FilledButton.tonalIcon(
                  onPressed: onCrop,
                  icon: const Icon(Icons.crop, size: 16),
                  label: Text('Crop', style: textTheme.labelMedium),
                  style: FilledButton.styleFrom(
                    minimumSize: Size.zero,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 8),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton.tonalIcon(
                  onPressed: onRetake,
                  icon: const Icon(Icons.camera_alt_outlined, size: 16),
                  label: Text('Retake', style: textTheme.labelMedium),
                  style: FilledButton.styleFrom(
                    minimumSize: Size.zero,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 8),
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
