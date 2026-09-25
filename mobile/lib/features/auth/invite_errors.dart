/// Turns a failed invite acceptance into a message a person can act on.
///
/// The server answers with `{ code, message }`; the code decides the text.
/// Older logic guessed from the exception string, which carries only the
/// HTTP status, so an expired, used or rate-limited invite all showed the
/// same "Something went wrong".
String inviteErrorMessage({int? status, String? code, String raw = ''}) {
  switch (code) {
    case 'INVITE_NOT_FOUND':
    case 'INVALID_INVITE':
      return 'This invite link is not valid. Check you opened the whole link, or ask your administrator for a new one.';
    case 'INVITE_EXPIRED':
      return 'This invite link has expired. Ask your administrator to send a new one.';
    case 'INVITE_ALREADY_USED':
      return 'This invite link has already been used. Each link works once: ask your administrator for a new one.';
    case 'ALREADY_MEMBER':
      return 'You have already joined with this invite on another device or install. Ask your administrator to send a new invite link to sign in again.';
    case 'INVITE_EMAIL_REQUIRED':
    case 'INVITE_REQUIRES_EMAIL':
      return 'This invite is for a named person. Enter the email address the invite was sent to.';
    case 'RATE_LIMITED':
    case 'TOO_MANY_REQUESTS':
      return 'Too many attempts from this network. Wait a few minutes and try again.';
    case 'VALIDATION_ERROR':
      return 'Check your name and email address, then try again.';
  }

  if (status != null) {
    if (status == 404) {
      return 'This invite link is not valid. Check you opened the whole link, or ask your administrator for a new one.';
    }
    if (status == 429) return 'Too many attempts from this network. Wait a few minutes and try again.';
    if (status >= 300 && status < 400) {
      return 'The invite link points to an address the app cannot use. Open it from the invite page on the website, or ask your administrator for a new link.';
    }
    if (status >= 500) return 'The server is temporarily unavailable. Try again in a moment.';
  }

  final msg = raw.toLowerCase();
  if (msg.contains('failed host lookup') ||
      msg.contains('connection refused') ||
      msg.contains('no address associated') ||
      msg.contains('no route to host') ||
      msg.contains('os error: 7') ||
      msg.contains('os error: 61') ||
      msg.contains('os error: 65') ||
      msg.contains('os error: 111')) {
    return 'Could not reach the server. Make sure you opened the full invite link from your administrator.';
  }
  if (msg.contains('socketexception') ||
      msg.contains('network is unreachable') ||
      msg.contains('connection timeout') ||
      msg.contains('receive timeout') ||
      msg.contains('timed out')) {
    return 'Could not connect. Check your internet connection and try again.';
  }

  final suffix = status != null ? ' (error $status)' : '';
  return 'Something went wrong$suffix. Please try again or ask your administrator to resend the invite link.';
}
