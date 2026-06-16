import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/endpoints.dart';

class InviteScreen extends StatefulWidget {
  final String token;

  const InviteScreen({super.key, required this.token});

  @override
  State<InviteScreen> createState() => _InviteScreenState();
}

class _InviteScreenState extends State<InviteScreen> {
  static const _storage = FlutterSecureStorage();

  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();

  bool _loading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _joinOrganisation() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _loading = true;
      _errorMessage = null;
    });

    try {
      final response = await acceptInvite(
        token: widget.token,
        name: _nameController.text.trim(),
        email: _emailController.text.trim().isEmpty
            ? null
            : _emailController.text.trim(),
      );

      await Future.wait([
        _storage.write(key: 'session_token', value: response.sessionToken),
        _storage.write(key: 'user_id', value: response.userId),
        _storage.write(key: 'user_name', value: response.userName),
        _storage.write(key: 'org_id', value: response.orgId),
        _storage.write(key: 'org_name', value: response.orgName),
      ]);

      if (!mounted) return;
      context.go('/pin-setup');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = _friendlyError(e);
        _loading = false;
      });
    }
  }

  String _friendlyError(Object e) {
    final msg = e.toString().toLowerCase();

    if (msg.contains('404') ||
        msg.contains('invalid') ||
        msg.contains('expired') ||
        msg.contains('already_used')) {
      return 'This invite link is invalid or has already been used. Ask your administrator to send a new one.';
    }

    if (msg.contains('connection refused') ||
        msg.contains('localhost') ||
        msg.contains('127.0.0.1') ||
        msg.contains('os error: 111') ||
        msg.contains('os error: 61') ||
        msg.contains('failed host lookup') ||
        msg.contains('no address associated') ||
        msg.contains('no route to host') ||
        msg.contains('os error: 7') ||
        msg.contains('os error: 65')) {
      return 'Could not reach the server. Make sure you pasted the full invite link from your administrator.';
    }

    if (msg.contains('socketexception') ||
        msg.contains('network is unreachable') ||
        msg.contains('network unreachable')) {
      return 'No internet connection. Check your network and try again.';
    }

    if (msg.contains('500') || msg.contains('502') || msg.contains('503')) {
      return 'The server is temporarily unavailable. Try again in a moment.';
    }

    return 'Something went wrong. Please try again or ask your administrator to resend the invite link.';
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      backgroundColor: colorScheme.surface,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 48),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Brand mark
                Column(
                  children: [
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: colorScheme.primary,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: const Icon(Icons.eco, color: Colors.white, size: 40),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'CarbonSite',
                      style: textTheme.headlineMedium?.copyWith(
                        color: colorScheme.primary,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 40),

                Text(
                  "You've been invited",
                  style: textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: colorScheme.onSurface,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'Enter your name to join your organisation and start submitting field records.',
                  style: textTheme.bodyMedium?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: 36),

                // Name — only required field for field workers
                TextFormField(
                  controller: _nameController,
                  keyboardType: TextInputType.name,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  autofocus: true,
                  decoration: const InputDecoration(
                    labelText: 'Your name',
                    hintText: 'e.g. Jane Smith',
                    prefixIcon: Icon(Icons.person_outline),
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) {
                    if (value == null || value.trim().length < 2) {
                      return 'Please enter your name';
                    }
                    return null;
                  },
                ),

                const SizedBox(height: 16),

                // Email — optional for field workers, required if invite is email-bound
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _loading ? null : _joinOrganisation(),
                  decoration: const InputDecoration(
                    labelText: 'Email address (optional)',
                    hintText: 'Leave blank if not required',
                    prefixIcon: Icon(Icons.email_outlined),
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) return null;
                    final emailRegex = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
                    if (!emailRegex.hasMatch(value.trim())) {
                      return 'Enter a valid email address';
                    }
                    return null;
                  },
                ),

                const SizedBox(height: 28),

                // Error
                if (_errorMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: colorScheme.errorContainer,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.info_outline,
                            color: colorScheme.onErrorContainer, size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _errorMessage!,
                            style: textTheme.bodySmall?.copyWith(
                                color: colorScheme.onErrorContainer),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                ],

                SizedBox(
                  height: 52,
                  child: FilledButton(
                    onPressed: _loading ? null : _joinOrganisation,
                    style: FilledButton.styleFrom(
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _loading
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                                strokeWidth: 2.5, color: Colors.white),
                          )
                        : const Text('Join Organisation',
                            style: TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w600)),
                  ),
                ),

                const SizedBox(height: 24),

                Text(
                  'By joining you agree to use CarbonSite only for authorised document submissions.',
                  style: textTheme.bodySmall
                      ?.copyWith(color: colorScheme.onSurfaceVariant),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
