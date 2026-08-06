// GPS-coordinate-based distance calculation.
//
// Primary path: calls OSRM for road-network distance (same provider used for
// postcode routes in route-distance.ts). Falls back to Haversine straight-line
// distance when OSRM is unavailable or returns no result — the road distance
// is typically ~1.2–1.5× the Haversine distance, so the fallback is
// conservative but prevents a submission from blocking with no distance at all.

const OSRM_BASE_URL =
  process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org";

export type GpsDistanceResult = {
  distanceKm: number;
  source: "gps_osrm" | "gps_haversine";
};

// Haversine formula — straight-line distance over Earth's surface (km).
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// Calculate road distance using OSRM, falling back to Haversine.
// Non-throwing: always returns a result so submission intake isn't blocked.
export async function calculateGpsDistanceKm(params: {
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
}): Promise<GpsDistanceResult> {
  try {
    const url =
      `${OSRM_BASE_URL}/route/v1/driving/` +
      `${params.pickupLng},${params.pickupLat};` +
      `${params.deliveryLng},${params.deliveryLat}` +
      "?overview=false&alternatives=false&steps=false";

    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);

    const body = (await res.json()) as {
      routes?: Array<{ distance?: number }>;
    };
    const distanceM = body.routes?.[0]?.distance;
    if (!distanceM || !Number.isFinite(distanceM) || distanceM <= 0) {
      throw new Error("OSRM returned no distance");
    }

    return { distanceKm: distanceM / 1000, source: "gps_osrm" };
  } catch {
    // OSRM unavailable or timed out — use Haversine as conservative fallback.
    return {
      distanceKm: haversineDistanceKm(
        params.pickupLat,
        params.pickupLng,
        params.deliveryLat,
        params.deliveryLng,
      ),
      source: "gps_haversine",
    };
  }
}
