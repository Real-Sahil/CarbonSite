import 'package:flutter_test/flutter_test.dart';
import 'package:metricora_mobile/core/api/client.dart';
import 'package:metricora_mobile/features/auth/invite_errors.dart';

void main() {
  test('uses the server code, not a generic message', () {
    expect(inviteErrorMessage(status: 400, code: 'INVITE_EXPIRED'), contains('expired'));
    expect(inviteErrorMessage(status: 400, code: 'INVITE_ALREADY_USED'), contains('already been used'));
    expect(inviteErrorMessage(status: 409, code: 'ALREADY_MEMBER'), contains('already joined'));
    expect(inviteErrorMessage(status: 429, code: 'RATE_LIMITED'), contains('Too many attempts'));
  });

  test('explains a redirect and shows the status on anything unknown', () {
    expect(inviteErrorMessage(status: 308), contains('cannot use'));
    expect(inviteErrorMessage(status: 418), contains('(error 418)'));
  });

  test('sends the bare domain to www so the POST is not redirected', () {
    expect(normalizeBaseUrl('https://metricora.co.uk'), 'https://www.metricora.co.uk');
    expect(normalizeBaseUrl('https://www.metricora.co.uk/'), 'https://www.metricora.co.uk');
  });
}
