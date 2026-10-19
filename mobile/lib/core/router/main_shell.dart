import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show ScrollDirection;
import 'package:go_router/go_router.dart';
import '../notifications/fcm_handler.dart';

/// Floating pill navigation around the three main tabs:
/// Dashboard / Projects / Submissions. Capture is pushed above the shell.
class MainShell extends StatefulWidget {
  final StatefulNavigationShell navigationShell;

  const MainShell({super.key, required this.navigationShell});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  // The pill slides away while the user scrolls down and returns on the way up.
  bool _navHidden = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      FcmHandler.consumePendingNavigation(context);
    });
  }

  bool _onScroll(ScrollNotification notification) {
    if (notification is! UserScrollNotification) return false;
    if (notification.metrics.axis != Axis.vertical) return false;
    final direction = notification.direction;
    var hide = _navHidden;
    if (direction == ScrollDirection.reverse) hide = true;
    if (direction == ScrollDirection.forward) hide = false;
    if (notification.metrics.pixels <= 0) hide = false;
    if (hide != _navHidden) setState(() => _navHidden = hide);
    return false;
  }

  void _select(int index) {
    final shell = widget.navigationShell;
    setState(() => _navHidden = false);
    shell.goBranch(
      index,
      // Re-tapping the active tab resets it to its root.
      initialLocation: index == shell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: NotificationListener<ScrollNotification>(
        onNotification: _onScroll,
        child: widget.navigationShell,
      ),
      bottomNavigationBar: AnimatedSize(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
        alignment: Alignment.bottomCenter,
        child: _navHidden
            ? const SizedBox.shrink()
            : _PillNav(
                index: widget.navigationShell.currentIndex,
                onSelected: _select,
              ),
      ),
    );
  }
}

class _Tab {
  final String label;
  final IconData icon;
  final IconData selectedIcon;

  const _Tab(this.label, this.icon, this.selectedIcon);
}

const _tabs = [
  _Tab('Dashboard', Icons.insights_outlined, Icons.insights),
  _Tab('Projects', Icons.folder_outlined, Icons.folder),
  _Tab('Submissions', Icons.receipt_long_outlined, Icons.receipt_long),
];

/// Floating pill with a highlight that slides behind the active tab.
class _PillNav extends StatelessWidget {
  final int index;
  final ValueChanged<int> onSelected;

  const _PillNav({required this.index, required this.onSelected});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Material(
        color: colorScheme.surface,
        elevation: 6,
        shadowColor: Colors.black26,
        shape: const StadiumBorder(),
        clipBehavior: Clip.antiAlias,
        child: SizedBox(
          height: 64,
          child: Stack(
            children: [
              // Moves by alignment only, so the highlight never relayouts.
              AnimatedAlign(
                duration: const Duration(milliseconds: 260),
                curve: Curves.easeOutCubic,
                alignment: Alignment(-1 + 2 * index / (_tabs.length - 1), 0),
                child: FractionallySizedBox(
                  widthFactor: 1 / _tabs.length,
                  heightFactor: 1,
                  child: Padding(
                    padding: const EdgeInsets.all(6),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: colorScheme.secondaryContainer,
                        borderRadius: BorderRadius.circular(32),
                      ),
                    ),
                  ),
                ),
              ),
              Row(
                children: List.generate(
                  _tabs.length,
                  (i) => Expanded(
                    child: _PillItem(
                      tab: _tabs[i],
                      selected: i == index,
                      onTap: () => onSelected(i),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PillItem extends StatelessWidget {
  final _Tab tab;
  final bool selected;
  final VoidCallback onTap;

  const _PillItem({
    required this.tab,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final labelStyle = Theme.of(context).textTheme.labelMedium;
    final color = selected
        ? colorScheme.onSecondaryContainer
        : colorScheme.onSurfaceVariant;
    return Semantics(
      button: true,
      selected: selected,
      label: tab.label,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(selected ? tab.selectedIcon : tab.icon, color: color),
              Text(
                tab.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: labelStyle?.copyWith(
                  color: color,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
