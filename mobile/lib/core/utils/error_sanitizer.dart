/// Sanitizes error messages to remove sensitive information.
class ErrorSanitizer {
  static String sanitize(String message) {
    if (message.isEmpty) return 'An error occurred. Please try again.';

    var sanitized = message;

    // Remove URLs containing API endpoints or hostnames
    sanitized = sanitized.replaceAll(
      RegExp(r"https?://[a-zA-Z0-9\-.]+(:[0-9]+)?(/[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=%]*)?"),
      '[REDACTED_URL]',
    );

    // Remove database connection strings
    sanitized = sanitized.replaceAll(
      RegExp(r'(postgres|mysql|mongodb):\/\/[^\s]+'),
      '[REDACTED_CONNECTION_STRING]',
    );

    // Remove API keys (sk_test_, sk_live_, etc.)
    sanitized = sanitized.replaceAll(
      RegExp(r'sk_(test|live)_[a-zA-Z0-9]{24,}'),
      '[REDACTED_API_KEY]',
    );

    // Remove bearer tokens and auth tokens (JWT-like patterns)
    sanitized = sanitized.replaceAll(
      RegExp(r'bearer\s+[a-zA-Z0-9\-._~\+/]+=*', caseSensitive: false),
      'Bearer [REDACTED_TOKEN]',
    );

    // Remove email addresses in full (keep if user entered it)
    if (!message.contains('@') || message.split('@').length > 3) {
      sanitized = sanitized.replaceAll(
        RegExp(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'),
        '[REDACTED_EMAIL]',
      );
    }

    return sanitized.isNotEmpty
        ? sanitized
        : 'An error occurred. Please try again.';
  }
}
