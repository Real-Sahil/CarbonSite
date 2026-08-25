import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_tile_caching/flutter_map_tile_caching.dart';
import 'package:latlong2/latlong.dart';

/// A compact map widget that shows a pin at the given GPS coordinate.
///
/// Tiles are cached via flutter_map_tile_caching so the map renders offline
/// once the area has been visited at least once while online.
///
/// Usage:
///   GpsLocationMap(lat: position.latitude, lng: position.longitude)
///
/// Initialise the tile store once at app startup (e.g. in main()):
///   await FlutterMapTileCaching.initialise();
///   await FMTC.instance('mainStore').manage.createAsync();
class GpsLocationMap extends StatelessWidget {
  final double lat;
  final double lng;
  final double height;
  final double zoom;

  const GpsLocationMap({
    super.key,
    required this.lat,
    required this.lng,
    this.height = 160,
    this.zoom = 15,
  });

  @override
  Widget build(BuildContext context) {
    final point = LatLng(lat, lng);

    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        height: height,
        child: FlutterMap(
          options: MapOptions(
            initialCenter: point,
            initialZoom: zoom,
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.none, // static preview, no pan/zoom
            ),
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'app.carbonsite.mobile',
              tileProvider: FMTCStore('mainStore').getTileProvider(
                settings: FMTCTileProviderSettings(
                  behavior: CacheBehavior.cacheFirst,
                ),
              ),
            ),
            MarkerLayer(
              markers: [
                Marker(
                  point: point,
                  width: 36,
                  height: 36,
                  child: const Icon(
                    Icons.location_pin,
                    color: Colors.red,
                    size: 36,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
