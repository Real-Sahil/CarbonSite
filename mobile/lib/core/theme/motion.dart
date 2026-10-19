import 'package:flutter/material.dart';

bool _reduced(BuildContext context) => MediaQuery.of(context).disableAnimations;

const _easeOut = Curves.easeOutCubic;

/// Counts a number up from zero (or from its previous value) when it changes.
class CountUp extends StatelessWidget {
  final double value;
  final String Function(double) format;
  final TextStyle? style;

  const CountUp({
    super.key,
    required this.value,
    required this.format,
    this.style,
  });

  @override
  Widget build(BuildContext context) {
    final fontFeatures = const [FontFeature.tabularFigures()];
    final base = (style ?? DefaultTextStyle.of(context).style)
        .copyWith(fontFeatures: fontFeatures);
    if (_reduced(context)) return Text(format(value), style: base);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value),
      duration: const Duration(milliseconds: 900),
      curve: _easeOut,
      builder: (_, v, __) => Text(format(v), style: base),
    );
  }
}

/// Fades and rises a child in, delayed by [index] steps of 45 ms (capped).
class StaggerIn extends StatelessWidget {
  final int index;
  final Widget child;

  const StaggerIn({super.key, required this.index, required this.child});

  @override
  Widget build(BuildContext context) {
    if (_reduced(context)) return child;
    final delay = 45 * (index > 8 ? 8 : index);
    const total = 380;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: total + delay),
      curve: Interval(delay / (total + delay), 1, curve: _easeOut),
      builder: (_, t, c) => Opacity(
        opacity: t,
        child: Transform.translate(offset: Offset(0, 14 * (1 - t)), child: c),
      ),
      child: child,
    );
  }
}

/// A grey block that breathes while content loads. Holds still under reduced motion.
class Skeleton extends StatefulWidget {
  final double height;
  final double radius;

  const Skeleton({super.key, required this.height, this.radius = 12});

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);
  late final Animation<double> _fade = Tween<double>(begin: 0.5, end: 1).animate(_pulse);

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final block = Container(
      height: widget.height,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(widget.radius),
      ),
    );
    if (_reduced(context)) return block;
    return FadeTransition(opacity: _fade, child: block);
  }
}

/// Scales a tappable child to 0.97 while pressed.
class PressScale extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;

  const PressScale({super.key, required this.child, this.onTap});

  @override
  State<PressScale> createState() => _PressScaleState();
}

class _PressScaleState extends State<PressScale> {
  bool _down = false;

  void _set(bool v) {
    if (_down != v) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (_) => _set(true),
      onPointerUp: (_) => _set(false),
      onPointerCancel: (_) => _set(false),
      child: AnimatedScale(
        scale: _down && !_reduced(context) ? 0.97 : 1,
        duration: const Duration(milliseconds: 120),
        curve: _easeOut,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: widget.onTap,
          child: widget.child,
        ),
      ),
    );
  }
}
