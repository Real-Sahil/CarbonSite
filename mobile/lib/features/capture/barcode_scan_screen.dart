import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

/// Full-screen barcode / QR code scanner.
///
/// Navigates back with the scanned [String] value on first successful detection.
/// The caller pushes this screen and awaits a `String?` result:
///
/// ```dart
/// final code = await Navigator.push<String>(
///   context,
///   MaterialPageRoute(builder: (_) => BarcodeScanScreen(onDetected: (c) => c)),
/// );
/// ```
///
/// [onDetected] is a transform/filter callback. Return the code to accept it,
/// or return `null` to ignore the barcode and keep scanning.
class BarcodeScanScreen extends StatefulWidget {
  final String? Function(String code) onDetected;

  const BarcodeScanScreen({super.key, required this.onDetected});

  @override
  State<BarcodeScanScreen> createState() => _BarcodeScanScreenState();
}

class _BarcodeScanScreenState extends State<BarcodeScanScreen> {
  final MobileScannerController _controller = MobileScannerController();
  bool _detected = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_detected) return;
    for (final barcode in capture.barcodes) {
      final raw = barcode.rawValue;
      if (raw == null || raw.isEmpty) continue;
      final result = widget.onDetected(raw);
      if (result != null) {
        _detected = true;
        // Pop with the accepted code.
        Navigator.of(context).pop(result);
        return;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Full-screen camera preview
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),

          // Viewfinder overlay
          const _ViewfinderOverlay(),

          // Top bar: close button
          SafeArea(
            child: Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Material(
                  color: Colors.black54,
                  shape: const CircleBorder(),
                  child: IconButton(
                    icon: const Icon(Icons.close, color: Colors.white),
                    tooltip: 'Close',
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ),
              ),
            ),
          ),

          // Hint text at the bottom
          SafeArea(
            child: Align(
              alignment: Alignment.bottomCenter,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 48),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Text(
                    'Align barcode or QR code',
                    style: TextStyle(
                      color: colorScheme.onPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Draws a semi-transparent overlay with a clear viewfinder rectangle in the
/// centre and corner accent marks.
class _ViewfinderOverlay extends StatelessWidget {
  const _ViewfinderOverlay();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _OverlayPainter(),
      child: const SizedBox.expand(),
    );
  }
}

/// Paints a dark scrim with a clear rectangular cutout, then draws the
/// four corner bracket accents inside the cutout.
class _OverlayPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final cutSide = size.width * 0.68;
    final cutLeft = (size.width - cutSide) / 2;
    final cutTop = (size.height - cutSide) / 2.2;
    final cutRect = Rect.fromLTWH(cutLeft, cutTop, cutSide, cutSide);
    const cornerRadius = 10.0;
    final cutRRect = RRect.fromRectAndRadius(
      cutRect,
      const Radius.circular(cornerRadius),
    );

    // Scrim: full canvas minus the cutout
    final scrimPaint = Paint()..color = Colors.black54;
    final scrimPath = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
      ..addRRect(cutRRect)
      ..fillType = PathFillType.evenOdd;
    canvas.drawPath(scrimPath, scrimPaint);

    // Corner brackets drawn relative to the cutout rect
    const armLength = 28.0;
    const strokeWidth = 3.5;
    const r = 8.0;

    final bracketPaint = Paint()
      ..color = Colors.white
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final l = cutRect.left;
    final t = cutRect.top;
    final ri = cutRect.right;
    final bo = cutRect.bottom;

    // Top-left
    canvas.drawPath(
      Path()
        ..moveTo(l, t + armLength)
        ..lineTo(l, t + r)
        ..arcToPoint(Offset(l + r, t), radius: const Radius.circular(r))
        ..lineTo(l + armLength, t),
      bracketPaint,
    );

    // Top-right
    canvas.drawPath(
      Path()
        ..moveTo(ri - armLength, t)
        ..lineTo(ri - r, t)
        ..arcToPoint(Offset(ri, t + r), radius: const Radius.circular(r))
        ..lineTo(ri, t + armLength),
      bracketPaint,
    );

    // Bottom-left
    canvas.drawPath(
      Path()
        ..moveTo(l, bo - armLength)
        ..lineTo(l, bo - r)
        ..arcToPoint(Offset(l + r, bo),
            radius: const Radius.circular(r))
        ..lineTo(l + armLength, bo),
      bracketPaint,
    );

    // Bottom-right
    canvas.drawPath(
      Path()
        ..moveTo(ri - armLength, bo)
        ..lineTo(ri - r, bo)
        ..arcToPoint(Offset(ri, bo - r),
            radius: const Radius.circular(r), clockwise: false)
        ..lineTo(ri, bo - armLength),
      bracketPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
