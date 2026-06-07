import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import '../../core/api/endpoints.dart';

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
  String? _error;
  String? _success;

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
    setState(() => _evidenceImage = picked);
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

      final evidenceIds = <String>[];
      final image = _evidenceImage;
      if (image != null) {
        final bytes = await image.readAsBytes();
        final upload = await uploadEvidenceFile(
          orgId: orgId,
          filename: p.basename(image.path),
          contentType: image.mimeType ?? _contentTypeForPath(image.path),
          bytes: bytes,
        );
        if (upload.id.isNotEmpty) {
          evidenceIds.add(upload.id);
        }
      }

      await submitFieldSubmission(
        orgId: orgId,
        reportingPeriodId: widget.reportingPeriodId,
        documentType: _documentType,
        evidenceIds: evidenceIds,
        pickupPostcode: _pickupController.text.trim(),
        deliveryPostcode: _deliveryController.text.trim(),
        gpsLat: position?.latitude,
        gpsLng: position?.longitude,
        formData: {
          'sourceDescription': _sourceController.text.trim(),
          'amount': double.parse(_amountController.text.trim()),
          'unit': _unitController.text.trim(),
          'supplierName': _supplierController.text.trim(),
          'pickupPostcode': _pickupController.text.trim(),
          'deliveryPostcode': _deliveryController.text.trim(),
        },
      );

      if (!mounted) return;
      setState(() {
        _success = 'Submission sent for review.';
        _sourceController.clear();
        _amountController.clear();
        _supplierController.clear();
        _pickupController.clear();
        _deliveryController.clear();
        _evidenceImage = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not submit document. Check the connection and values.';
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
                  onPressed: _submitting ? null : _pickEvidenceImage,
                  icon: const Icon(Icons.photo_camera_outlined),
                  label: Text(
                    _evidenceImage == null
                        ? 'Capture evidence photo'
                        : 'Evidence: ${p.basename(_evidenceImage!.path)}',
                  ),
                ),
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
