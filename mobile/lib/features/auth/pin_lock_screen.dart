import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/client.dart';

/// In-memory unlock state for the current app process. The router redirect
/// checks this: with a session + stored PIN, the app opens on the lock
/// screen until the PIN is verified. Restarting the app locks it again.
class PinLock {
  PinLock._();
  static bool unlocked = false;
}

class PinLockScreen extends StatefulWidget {
  const PinLockScreen({super.key});

  @override
  State<PinLockScreen> createState() => _PinLockScreenState();
}

class _PinLockScreenState extends State<PinLockScreen> {
  static const _storage = FlutterSecureStorage();
  static const int _pinLength = 4;

  String _input = '';
  String? _error;
  int _failedAttempts = 0;

  Future<void> _onDigit(String digit) async {
    if (_input.length >= _pinLength) return;
    setState(() {
      _input += digit;
      _error = null;
    });
    if (_input.length == _pinLength) {
      await _verify();
    }
  }

  void _onBackspace() {
    if (_input.isEmpty) return;
    setState(() => _input = _input.substring(0, _input.length - 1));
  }

  Future<void> _verify() async {
    final storedPin = await _storage.read(key: 'pin');
    if (!mounted) return;
    if (storedPin != null && storedPin == _input) {
      PinLock.unlocked = true;
      context.go('/dashboard');
      return;
    }
    setState(() {
      _failedAttempts += 1;
      _input = '';
      _error = 'Incorrect PIN. Try again.';
    });
  }

  Future<void> _resetApp() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out of CarbonSite?'),
        content: const Text(
          'This clears the app on this device. You will need a new invite '
          'link from your administrator to sign back in. Unsynced drafts '
          'stay on the device until you sign in again.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    await _storage.delete(key: 'session_token');
    await _storage.delete(key: 'pin');
    invalidateClient();
    PinLock.unlocked = false;
    if (!mounted) return;
    context.go('/pin-setup');
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      backgroundColor: colorScheme.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
          child: Column(
            children: [
              const Spacer(),
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: colorScheme.primary,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(Icons.lock_outline, color: Colors.white, size: 32),
              ),
              const SizedBox(height: 20),
              Text(
                'Enter your PIN',
                style: textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(_pinLength, (index) {
                  final filled = index < _input.length;
                  return Container(
                    width: 16,
                    height: 16,
                    margin: const EdgeInsets.symmetric(horizontal: 8),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: filled ? colorScheme.primary : Colors.transparent,
                      border: Border.all(
                        color: filled ? colorScheme.primary : colorScheme.outline,
                        width: 2,
                      ),
                    ),
                  );
                }),
              ),
              const SizedBox(height: 16),
              SizedBox(
                height: 20,
                child: _error != null
                    ? Text(
                        _error!,
                        style: textTheme.bodySmall?.copyWith(color: colorScheme.error),
                      )
                    : null,
              ),
              const Spacer(),
              _Keypad(
                onDigit: _onDigit,
                onBackspace: _onBackspace,
              ),
              const SizedBox(height: 16),
              if (_failedAttempts >= 3)
                TextButton(
                  onPressed: _resetApp,
                  child: const Text('Forgot PIN? Sign out and use a new invite'),
                )
              else
                TextButton(
                  onPressed: _resetApp,
                  child: Text(
                    'Sign out',
                    style: TextStyle(color: colorScheme.onSurfaceVariant),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Keypad extends StatelessWidget {
  final void Function(String digit) onDigit;
  final VoidCallback onBackspace;

  const _Keypad({required this.onDigit, required this.onBackspace});

  @override
  Widget build(BuildContext context) {
    final rows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', '<'],
    ];
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: rows
          .map(
            (row) => Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: row.map((key) => _key(context, key)).toList(),
            ),
          )
          .toList(),
    );
  }

  Widget _key(BuildContext context, String key) {
    if (key.isEmpty) {
      return const SizedBox(width: 88, height: 68);
    }
    final isBackspace = key == '<';
    return SizedBox(
      width: 88,
      height: 68,
      child: TextButton(
        onPressed: isBackspace ? onBackspace : () => onDigit(key),
        child: isBackspace
            ? const Icon(Icons.backspace_outlined, size: 22)
            : Text(
                key,
                style: Theme.of(context)
                    .textTheme
                    .headlineSmall
                    ?.copyWith(fontWeight: FontWeight.w600),
              ),
      ),
    );
  }
}
