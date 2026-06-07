import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';

enum _PinStep { entry, confirm }

class PinSetupScreen extends StatefulWidget {
  const PinSetupScreen({super.key});

  @override
  State<PinSetupScreen> createState() => _PinSetupScreenState();
}

class _PinSetupScreenState extends State<PinSetupScreen> {
  static const _storage = FlutterSecureStorage();
  static const int _pinLength = 4;

  _PinStep _step = _PinStep.entry;
  String _firstPin = '';
  String _currentInput = '';
  String? _errorMessage;
  bool _saving = false;

  void _onDigitTap(String digit) {
    if (_currentInput.length >= _pinLength) return;
    setState(() {
      _currentInput += digit;
      _errorMessage = null;
    });

    if (_currentInput.length == _pinLength) {
      // Small delay so the last dot fills before we transition
      Future.delayed(const Duration(milliseconds: 120), _onPinComplete);
    }
  }

  void _onDelete() {
    if (_currentInput.isEmpty) return;
    setState(() {
      _currentInput = _currentInput.substring(0, _currentInput.length - 1);
      _errorMessage = null;
    });
  }

  void _onPinComplete() {
    if (_step == _PinStep.entry) {
      setState(() {
        _firstPin = _currentInput;
        _currentInput = '';
        _step = _PinStep.confirm;
      });
    } else {
      _confirmPin();
    }
  }

  Future<void> _confirmPin() async {
    if (_currentInput != _firstPin) {
      setState(() {
        _errorMessage = 'PINs do not match. Please try again.';
        _currentInput = '';
        _step = _PinStep.entry;
        _firstPin = '';
      });
      return;
    }

    setState(() => _saving = true);

    try {
      await _storage.write(key: 'pin', value: _currentInput);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _errorMessage = 'Failed to save PIN. Please try again.';
        _currentInput = '';
        _step = _PinStep.entry;
        _firstPin = '';
      });
      return;
    }

    if (!mounted) return;
    context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      backgroundColor: colorScheme.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            children: [
              const SizedBox(height: 56),

              // Icon
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: colorScheme.primaryContainer,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.lock_outline,
                  color: colorScheme.primary,
                  size: 32,
                ),
              ),

              const SizedBox(height: 24),

              // Heading
              Text(
                _step == _PinStep.entry ? 'Set Your PIN' : 'Confirm Your PIN',
                style: textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: colorScheme.onSurface,
                ),
                textAlign: TextAlign.center,
              ),

              const SizedBox(height: 8),

              Text(
                _step == _PinStep.entry
                    ? 'This PIN protects your device access to CarbonSite'
                    : 'Re-enter your PIN to confirm',
                style: textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),

              const SizedBox(height: 40),

              // PIN dots
              _PinDots(
                pinLength: _pinLength,
                currentLength: _currentInput.length,
                hasError: _errorMessage != null,
                primaryColor: colorScheme.primary,
                errorColor: colorScheme.error,
              ),

              const SizedBox(height: 16),

              // Error message
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: _errorMessage != null
                    ? Container(
                        key: ValueKey(_errorMessage),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 10),
                        decoration: BoxDecoration(
                          color: colorScheme.errorContainer,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.error_outline,
                                size: 16, color: colorScheme.onErrorContainer),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                _errorMessage!,
                                style: textTheme.bodySmall?.copyWith(
                                  color: colorScheme.onErrorContainer,
                                ),
                              ),
                            ),
                          ],
                        ),
                      )
                    : const SizedBox(key: ValueKey('no-error'), height: 36),
              ),

              const Spacer(),

              // Keypad
              if (_saving)
                const CircularProgressIndicator()
              else
                _NumPad(
                  onDigit: _onDigitTap,
                  onDelete: _onDelete,
                ),

              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// PIN dots indicator
// ---------------------------------------------------------------------------

class _PinDots extends StatelessWidget {
  final int pinLength;
  final int currentLength;
  final bool hasError;
  final Color primaryColor;
  final Color errorColor;

  const _PinDots({
    required this.pinLength,
    required this.currentLength,
    required this.hasError,
    required this.primaryColor,
    required this.errorColor,
  });

  @override
  Widget build(BuildContext context) {
    final activeColor = hasError ? errorColor : primaryColor;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(pinLength, (index) {
        final filled = index < currentLength;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          margin: const EdgeInsets.symmetric(horizontal: 10),
          width: 20,
          height: 20,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: filled ? activeColor : Colors.transparent,
            border: Border.all(
              color: filled ? activeColor : activeColor.withValues(alpha: 0.4),
              width: 2,
            ),
          ),
        );
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// Number pad
// ---------------------------------------------------------------------------

class _NumPad extends StatelessWidget {
  final void Function(String digit) onDigit;
  final VoidCallback onDelete;

  const _NumPad({required this.onDigit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    // Layout: 3-column grid. Digits 1-9, then [blank, 0, delete].
    final cells = <Widget>[
      ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(
        (d) => _DigitButton(digit: d, onTap: () => onDigit(d)),
      ),
      const SizedBox.shrink(), // bottom-left blank
      _DigitButton(digit: '0', onTap: () => onDigit('0')),
      _DeleteButton(onTap: onDelete, color: colorScheme.onSurfaceVariant),
    ];

    return GridView.count(
      crossAxisCount: 3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 1.5,
      mainAxisSpacing: 4,
      crossAxisSpacing: 4,
      children: cells,
    );
  }
}

class _DigitButton extends StatelessWidget {
  final String digit;
  final VoidCallback onTap;

  const _DigitButton({required this.digit, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;

    return TextButton(
      onPressed: onTap,
      style: TextButton.styleFrom(
        shape: const CircleBorder(),
        padding: EdgeInsets.zero,
        foregroundColor: colorScheme.onSurface,
        overlayColor: colorScheme.primary.withValues(alpha: 0.12),
      ),
      child: Text(
        digit,
        style: textTheme.headlineSmall?.copyWith(
          fontWeight: FontWeight.w500,
          color: colorScheme.onSurface,
        ),
      ),
    );
  }
}

class _DeleteButton extends StatelessWidget {
  final VoidCallback onTap;
  final Color color;

  const _DeleteButton({required this.onTap, required this.color});

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onTap,
      style: TextButton.styleFrom(
        shape: const CircleBorder(),
        padding: EdgeInsets.zero,
        foregroundColor: color,
      ),
      child: Icon(Icons.backspace_outlined, color: color, size: 24),
    );
  }
}
