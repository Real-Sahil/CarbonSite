import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import '../../core/offline/offline_submission_queue.dart';
import 'ocr_extractor.dart';

class CaptureScreen extends StatefulWidget {
  final String reportingPeriodId;

  const CaptureScreen({super.key, required this.reportingPeriodId});

  @override
  State<CaptureScreen> createState() => _CaptureScreenState();
}

class _CaptureScreenState extends State<CaptureScreen> {
  static const _storage = FlutterSecureStorage();
  final _formKey = GlobalKey<FormState>();
  final _sourceController = TextEditingController();
  final _amountController = TextEditingController();
  final _unitController = TextEditingController(text: 'kg');
  final _supplierController = TextEditingController();
  final _pickupController = TextEditingController();
  final _deliveryController = TextEditingController();
  final _picker = ImagePicker();
  String _documentType = 'waste_ticket';
  XFile? _evidenceImage;
  bool _submitting = false;
  bool _readingEvidence = false;
  String? _error;
  String? _success;
  String? _ocrStatus;
  Map<String, dynamic>? _ocrExtractedData;

  @override
  void dispose() {
    _sourceController.dispose();
    _amountController.dispose();
    _unitController.dispose();
    _supplierController.dispose();
    _pickupController.dispose();
    _deliveryController.dispose();
    super.dispose();
  }

  Future<void> _pickEvidenceImage() async {
    final picked = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 85,
    );
    if (!mounted || picked == null) return;
    setState(() {
      _evidenceImage = picked;
      _readingEvidence = true;
      _ocrStatus = 'Reading evidence text...';
      _ocrExtractedData = null;
    });

    try {
      final extracted = await _readEvidenceText(picked.path);
      if (!mounted) return;
      _applyExtractedFields(extracted);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _ocrStatus = 'Evidence captured. Text could not be read automatically.';
      });
    } finally {
      if (mounted) {
        setState(() => _readingEvidence = false);
      }
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
      _success = null;
    });

    try {
      final orgId = await _storage.read(key: 'org_id') ?? '';
      Position? position;
      try {
        final permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.always ||
            permission == LocationPermission.whileInUse) {
          position = await Geolocator.getCurrentPosition();
        }
      } catch (_) {
        position = null;
      }

      final image = _evidenceImage;
      final draft = await OfflineSubmissionQueue.createDraft(
        orgId: orgId,
        reportingPeriodId: widget.reportingPeriodId,
        documentType: _documentType,
        pickupPostcode: _pickupController.text.trim(),
        deliveryPostcode: _deliveryController.text.trim(),
        gpsLat: position?.latitude,
        gpsLng: position?.longitude,
        sourceEvidencePath: image?.path,
        evidenceFilename: image == null ? null : p.basename(image.path),
        evidenceContentType: image == null
            ? null
            : image.mimeType ?? _contentTypeForPath(image.path),
        ocrExtractedData: _ocrExtractedData,
        formData: {
          'sourceDescription': _sourceController.text.trim(),
          'amount': double.parse(_amountController.text.trim()),
          'unit': _unitController.text.trim(),
          'supplierName': _supplierController.text.trim(),
          'pickupPostcode': _pickupController.text.trim(),
          'deliveryPostcode': _deliveryController.text.trim(),
        },
      );
      await OfflineSubmissionQueue.enqueue(draft);
      final syncResult = await OfflineSubmissionQueue.syncPending();
      final isQueued = syncResult.failed > 0;

      if (!mounted) return;
      setState(() {
        _success = isQueued
            ? 'Submission saved offline and will sync when online.'
            : 'Submission sent for review.';
        _sourceController.clear();
        _amountController.clear();
        _supplierController.clear();
        _pickupController.clear();
        _deliveryController.clear();
        _evidenceImage = null;
        _ocrExtractedData = null;
        _ocrStatus = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error =
            'Could not save this document. Check the values and try again.';
      });
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  String _contentTypeForPath(String path) {
    final extension = p.extension(path).toLowerCase();
    if (extension == '.png') return 'image/png';
    if (extension == '.webp') return 'image/webp';
    return 'image/jpeg';
  }

  Future<ExtractedFields> _readEvidenceText(String path) async {
    final recognizer = TextRecognizer(script: TextRecognitionScript.latin);
    try {
      final recognized = await recognizer.processImage(
        InputImage.fromFilePath(path),
      );
      return OcrExtractor.extract(recognized.text, _documentTypeForOcr());
    } finally {
      await recognizer.close();
    }
  }

  DocumentType _documentTypeForOcr() {
    switch (_documentType) {
      case 'waste_ticket':
        return DocumentType.wasteTicket;
      case 'delivery_note':
        return DocumentType.deliveryNote;
      case 'fuel_receipt':
        return DocumentType.fuelReceipt;
      default:
        return DocumentType.other;
    }
  }

  void _applyExtractedFields(ExtractedFields extracted) {
    final data = _extractedData(extracted);
    final unitText = _unitController.text.trim().toLowerCase();
    final canReplaceUnit = unitText.isEmpty || unitText == 'kg';
    if (extracted.weight != null && _amountController.text.trim().isEmpty) {
      _amountController.text = extracted.weight!;
    }
    if (extracted.weightUnit != null && canReplaceUnit) {
      _unitController.text = extracted.weightUnit!;
    }
    if (extracted.volume != null && _amountController.text.trim().isEmpty) {
      _amountController.text = extracted.volume!;
    }
    if (extracted.volumeUnit != null && canReplaceUnit) {
      _unitController.text = extracted.volumeUnit!;
    }

    setState(() {
      _ocrExtractedData = data.isEmpty ? null : data;
      _ocrStatus = data.isEmpty
          ? 'Evidence captured. No structured fields were detected.'
          : 'Evidence text read and structured fields were captured.';
    });
  }

  Map<String, dynamic> _extractedData(ExtractedFields extracted) {
    return {
      'documentType': extracted.documentType.name,
      if (extracted.weight != null) 'weight': extracted.weight,
      if (extracted.weightUnit != null) 'weightUnit': extracted.weightUnit,
      if (extracted.ewcCode != null) 'ewcCode': extracted.ewcCode,
      if (extracted.date != null) 'date': extracted.date,
      if (extracted.vehicleReg != null) 'vehicleReg': extracted.vehicleReg,
      if (extracted.volume != null) 'volume': extracted.volume,
      if (extracted.volumeUnit != null) 'volumeUnit': extracted.volumeUnit,
    };
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Submit evidence')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Field document',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: _documentType,
                  decoration: const InputDecoration(labelText: 'Document type'),
                  items: const [
                    DropdownMenuItem(
                        value: 'waste_ticket', child: Text('Waste ticket')),
                    DropdownMenuItem(
                        value: 'delivery_note', child: Text('Delivery note')),
                    DropdownMenuItem(
                        value: 'fuel_receipt', child: Text('Fuel receipt')),
                    DropdownMenuItem(
                        value: 'other', child: Text('Other evidence')),
                  ],
                  onChanged: (value) =>
                      setState(() => _documentType = value ?? 'other'),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _submitting || _readingEvidence
                      ? null
                      : _pickEvidenceImage,
                  icon: _readingEvidence
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.photo_camera_outlined),
                  label: Text(
                    _evidenceImage == null
                        ? 'Capture evidence photo'
                        : 'Evidence: ${p.basename(_evidenceImage!.path)}',
                  ),
                ),
                if (_ocrStatus != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    _ocrStatus!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                        ),
                  ),
                ],
                const SizedBox(height: 12),
                TextFormField(
                  controller: _sourceController,
                  decoration:
                      const InputDecoration(labelText: 'Source description'),
                  validator: (value) => value == null || value.trim().isEmpty
                      ? 'Enter a source description'
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _amountController,
                  decoration: const InputDecoration(labelText: 'Amount'),
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  validator: (value) {
                    final amount = double.tryParse(value ?? '');
                    return amount == null || amount <= 0
                        ? 'Enter a positive amount'
                        : null;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _unitController,
                  decoration: const InputDecoration(labelText: 'Unit'),
                  validator: (value) => value == null || value.trim().isEmpty
                      ? 'Enter a unit'
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _supplierController,
                  decoration:
                      const InputDecoration(labelText: 'Supplier or haulier'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _pickupController,
                  decoration:
                      const InputDecoration(labelText: 'Pickup postcode'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _deliveryController,
                  decoration:
                      const InputDecoration(labelText: 'Delivery postcode'),
                ),
                const SizedBox(height: 20),
                if (_error != null)
                  Text(_error!, style: TextStyle(color: colorScheme.error)),
                if (_success != null)
                  Text(_success!, style: TextStyle(color: colorScheme.primary)),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _submitting ? null : _submit,
                    icon: const Icon(Icons.cloud_upload_outlined),
                    label: Text(
                        _submitting ? 'Submitting...' : 'Submit for review'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
