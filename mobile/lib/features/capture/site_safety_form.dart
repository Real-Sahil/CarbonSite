// Form data for hazard reports and site inspections, kept apart from the
// screen so it can be unit tested. The server checks the same shape
// (lib/field-submissions/safety-capture.ts).

enum HazardKind { hazard, nearMiss, unsafeAct, unsafeCondition, environmental }

const hazardKindLabels = <HazardKind, String>{
  HazardKind.hazard: 'Hazard',
  HazardKind.nearMiss: 'Near miss',
  HazardKind.unsafeAct: 'Unsafe act',
  HazardKind.unsafeCondition: 'Unsafe condition',
  HazardKind.environmental: 'Environmental concern',
};

String hazardKindApiValue(HazardKind kind) {
  switch (kind) {
    case HazardKind.hazard:
      return 'hazard';
    case HazardKind.nearMiss:
      return 'near_miss';
    case HazardKind.unsafeAct:
      return 'unsafe_act';
    case HazardKind.unsafeCondition:
      return 'unsafe_condition';
    case HazardKind.environmental:
      return 'environmental';
  }
}

enum InspectionResult { pass, fail, na }

String inspectionResultApiValue(InspectionResult r) {
  switch (r) {
    case InspectionResult.pass:
      return 'pass';
    case InspectionResult.fail:
      return 'fail';
    case InspectionResult.na:
      return 'na';
  }
}

String _date(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

String? _text(String? v) {
  final t = v?.trim() ?? '';
  return t.isEmpty ? null : t;
}

Map<String, dynamic> buildHazardFormData({
  required HazardKind kind,
  required String description,
  String? location,
  String? immediateAction,
  required DateTime observedOn,
  String? resubmittedFromId,
}) {
  return {
    'kind': hazardKindApiValue(kind),
    'description': description.trim(),
    if (_text(location) != null) 'location': _text(location),
    if (_text(immediateAction) != null) 'immediateAction': _text(immediateAction),
    'observedOn': _date(observedOn),
    if (resubmittedFromId != null) 'resubmittedFromId': resubmittedFromId,
  };
}

/// Only answered items are sent: an unanswered item never counts as a pass.
Map<String, dynamic> buildInspectionFormData({
  required String templateId,
  required String templateTitle,
  required String location,
  required DateTime inspectedOn,
  required List<String> items,
  required Map<String, InspectionResult> results,
  Map<String, String> notes = const {},
  String? resubmittedFromId,
}) {
  return {
    'templateId': templateId,
    'checklist': templateTitle,
    'location': location.trim(),
    'inspectedOn': _date(inspectedOn),
    'results': [
      for (final item in items)
        if (results[item] != null)
          {
            'item': item,
            'result': inspectionResultApiValue(results[item]!),
            if (results[item] == InspectionResult.fail && _text(notes[item]) != null) 'note': _text(notes[item]),
          },
    ],
    if (resubmittedFromId != null) 'resubmittedFromId': resubmittedFromId,
  };
}
