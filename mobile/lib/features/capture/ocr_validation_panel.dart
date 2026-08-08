import 'package:flutter/material.dart';

/// Compact inline panel shown above the submit button when OCR has extracted
/// fields. Displays per-field confidence so the worker knows which values to
/// verify before submitting.
///
/// Fields with confidence >= 0.85 are shown in green (high confidence).
/// Fields with confidence in [0.5, 0.85) are shown in amber (review suggested).
/// Fields with confidence < 0.5 (or null) are shown in red (manual entry required).
///
/// The panel collapses to a single-line summary when all fields are high confidence,
/// and expands to a scrollable list otherwise.
class OcrValidationPanel extends StatelessWidget {
  final Map<String, double> fieldConfidence;
  final Set<String> autoFilledFields;

  const OcrValidationPanel({
    super.key,
    required this.fieldConfidence,
    required this.autoFilledFields,
  });

  @override
  Widget build(BuildContext context) {
    if (autoFilledFields.isEmpty) return const SizedBox.shrink();

    final entries = autoFilledFields
        .map((k) => (field: k, confidence: fieldConfidence[k] ?? 0.0))
        .toList()
      ..sort((a, b) => a.confidence.compareTo(b.confidence));

    final highCount = entries.where((e) => e.confidence >= 0.85).length;
    final lowCount = entries.where((e) => e.confidence < 0.5).length;
    final allHigh = lowCount == 0 && entries.every((e) => e.confidence >= 0.85);

    final bannerColor = allHigh
        ? const Color(0xFFDCFCE7)
        : lowCount > 0
            ? const Color(0xFFFEF2F2)
            : const Color(0xFFFFFBEB);

    final iconColor = allHigh
        ? const Color(0xFF16A34A)
        : lowCount > 0
            ? const Color(0xFFDC2626)
            : const Color(0xFFD97706);

    final icon = allHigh ? Icons.check_circle_rounded : Icons.warning_amber_rounded;

    final summary = allHigh
        ? 'OCR extracted ${entries.length} fields with high confidence'
        : lowCount > 0
            ? '$lowCount field${lowCount > 1 ? 's' : ''} need manual review'
            : '${entries.length - highCount} field${entries.length - highCount > 1 ? 's' : ''} may need review';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: bannerColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: iconColor.withValues(alpha: 0.25),
        ),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          leading: Icon(icon, color: iconColor, size: 18),
          title: Text(
            summary,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: iconColor,
            ),
          ),
          tilePadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
          childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
          initiallyExpanded: !allHigh,
          children: entries.map((e) => _FieldRow(e.field, e.confidence)).toList(),
        ),
      ),
    );
  }
}

class _FieldRow extends StatelessWidget {
  final String field;
  final double confidence;

  const _FieldRow(this.field, this.confidence);

  @override
  Widget build(BuildContext context) {
    final pct = (confidence * 100).round();
    final Color color;
    final String label;

    if (confidence >= 0.85) {
      color = const Color(0xFF16A34A);
      label = 'High ($pct%)';
    } else if (confidence >= 0.5) {
      color = const Color(0xFFD97706);
      label = 'Review ($pct%)';
    } else {
      color = const Color(0xFFDC2626);
      label = 'Manual entry';
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Expanded(
            child: Text(
              _humanLabel(field),
              style: const TextStyle(fontSize: 12, color: Color(0xFF374151)),
            ),
          ),
          Container(
            width: confidence > 0 ? 80 * confidence : 0,
            height: 4,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 6),
          SizedBox(
            width: 90,
            child: Text(
              label,
              style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w500),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }

  String _humanLabel(String key) {
    const labels = {
      'weight': 'Weight',
      'ewcCode': 'EWC code',
      'date': 'Date',
      'vehicleReg': 'Vehicle reg',
      'supplierName': 'Supplier',
      'materialType': 'Material',
      'quantity': 'Quantity',
      'fuelType': 'Fuel type',
      'volume': 'Volume',
      'postcode': 'Postcode',
    };
    return labels[key] ?? key;
  }
}
