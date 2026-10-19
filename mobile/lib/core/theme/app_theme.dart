import 'package:flutter/material.dart';

/// MetricOra Material 3 theme.
///
/// Visual language: deep green + slate — professional construction-industry
/// field tooling (BRE SmartWaste class), not consumer-app pastel.
class AppTheme {
  AppTheme._();

  /// Deep green seed (Material green-900 family).
  static const Color seed = Color(0xFF1B5E20);

  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(seedColor: seed);
    final base = ThemeData(useMaterial3: true, colorScheme: scheme);

    return base.copyWith(
      scaffoldBackgroundColor: scheme.surfaceContainerLowest,
      appBarTheme: AppBarTheme(
        backgroundColor: scheme.surface,
        foregroundColor: scheme.onSurface,
        elevation: 0,
        scrolledUnderElevation: 1,
        centerTitle: false,
        titleTextStyle: base.textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
          color: scheme.onSurface,
        ),
      ),
      // Floating pill: MainShell supplies the rounded, inset container.
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.transparent,
        indicatorColor: scheme.primary,
        indicatorShape: const StadiumBorder(),
        surfaceTintColor: Colors.transparent,
        labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
        height: 64,
        iconTheme: WidgetStateProperty.resolveWith(
          (s) => IconThemeData(
            color: s.contains(WidgetState.selected)
                ? scheme.onPrimary
                : scheme.onSurfaceVariant,
          ),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: scheme.surface,
        surfaceTintColor: Colors.transparent,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: BorderSide(color: scheme.outlineVariant.withValues(alpha: 0.5)),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: const StadiumBorder(),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: scheme.primary,
          side: BorderSide(color: scheme.primary),
          shape: const StadiumBorder(),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
        floatingLabelBehavior: FloatingLabelBehavior.auto,
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
        ),
      ),
      dividerTheme: DividerThemeData(
        color: scheme.outlineVariant,
        thickness: 1,
        space: 1,
      ),
      textTheme: base.textTheme.copyWith(
        headlineMedium: base.textTheme.headlineMedium?.copyWith(
          fontWeight: FontWeight.w700,
          letterSpacing: -0.5,
        ),
        titleMedium: base.textTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// Shared status colours — chips, banners, chart segments.
///
/// amber = pending, blue = syncing, green = approved, red = rejected/failed,
/// slate = submitted (awaiting review).
class StatusPalette {
  StatusPalette._();

  static const Color pendingFg = Color(0xFF92400E); // amber-800
  static const Color pendingBg = Color(0xFFFEF3C7); // amber-100
  static const Color syncingFg = Color(0xFF1E40AF); // blue-800
  static const Color syncingBg = Color(0xFFDBEAFE); // blue-100
  static const Color submittedFg = Color(0xFF334155); // slate-700
  static const Color submittedBg = Color(0xFFE2E8F0); // slate-200
  static const Color approvedFg = Color(0xFF166534); // green-800
  static const Color approvedBg = Color(0xFFDCFCE7); // green-100
  static const Color rejectedFg = Color(0xFF991B1B); // red-800
  static const Color rejectedBg = Color(0xFFFEE2E2); // red-100

  // Chart palette for scope breakdown — deep green / teal / slate.
  static const Color scope1 = Color(0xFF1B5E20);
  static const Color scope2 = Color(0xFF0E7490);
  static const Color scope3 = Color(0xFF64748B);
}
