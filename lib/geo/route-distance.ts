import { createHash } from "crypto";
import { prisma } from "@/lib/db";

const POSTCODE_PROVIDER = "postcodes.io";
const ROUTING_PROVIDER = process.env.ROUTING_PROVIDER ?? "osrm";
const OSRM_BASE_URL =
  process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org";
const POSTCODES_BASE_URL =
  process.env.POSTCODES_BASE_URL ?? "https://api.postcodes.io";

export type RouteDistanceResult = {
  id: string;
  pickupPostcode: string;
  deliveryPostcode: string;
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
  distanceKm: number;
  durationSeconds: number | null;
  provider: string;
  calculationMethod: string;
};

export function normalizeUkPostcode(postcode: string): string {
  return postcode.replace(/\s+/g, "").toUpperCase();
}

export function displayUkPostcode(postcode: string): string {
  const normalized = normalizeUkPostcode(postcode);
  if (normalized.length <= 3) return normalized;
  return `${normalized.slice(0, -3)} ${normalized.slice(-3)}`;
}

export function isLikelyUkPostcode(postcode: string): boolean {
  return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(normalizeUkPostcode(postcode));
}

export async function getOrCreateRouteDistance(params: {
  organizationId: string;
  pickupPostcode: string;
  deliveryPostcode: string;
}): Promise<RouteDistanceResult> {
  const pickupPostcode = normalizeUkPostcode(params.pickupPostcode);
  const deliveryPostcode = normalizeUkPostcode(params.deliveryPostcode);

  if (!isLikelyUkPostcode(pickupPostcode) || !isLikelyUkPostcode(deliveryPostcode)) {
    throw new Error("Pickup and delivery postcodes must be valid UK postcode formats.");
  }

  const routeHash = hashRoute(params.organizationId, pickupPostcode, deliveryPostcode);
  const existing = await prisma.routeDistance.findUnique({
    where: { routeHash },
    include: { pickupGeocode: true, deliveryGeocode: true },
  });

  if (existing) {
    return {
      id: existing.id,
      pickupPostcode: existing.pickupPostcode,
      deliveryPostcode: existing.deliveryPostcode,
      pickupLat: Number(existing.pickupGeocode.latitude),
      pickupLng: Number(existing.pickupGeocode.longitude),
      deliveryLat: Number(existing.deliveryGeocode.latitude),
      deliveryLng: Number(existing.deliveryGeocode.longitude),
      distanceKm: Number(existing.distanceKm),
      durationSeconds: existing.durationSeconds,
      provider: existing.provider,
      calculationMethod: existing.calculationMethod,
    };
  }

  const [pickupGeocode, deliveryGeocode] = await Promise.all([
    getOrCreatePostcodeGeocode(pickupPostcode),
    getOrCreatePostcodeGeocode(deliveryPostcode),
  ]);
  const route = await calculateRoadRoute({
    pickupLat: Number(pickupGeocode.latitude),
    pickupLng: Number(pickupGeocode.longitude),
    deliveryLat: Number(deliveryGeocode.latitude),
    deliveryLng: Number(deliveryGeocode.longitude),
  });

  const created = await prisma.routeDistance.create({
    data: {
      organizationId: params.organizationId,
      pickupPostcode,
      deliveryPostcode,
      pickupGeocodeId: pickupGeocode.id,
      deliveryGeocodeId: deliveryGeocode.id,
      distanceKm: route.distanceKm,
      durationSeconds: route.durationSeconds,
      provider: route.provider,
      providerRouteId: route.providerRouteId,
      routeHash,
      calculationMethod: route.calculationMethod,
    },
  });

  return {
    id: created.id,
    pickupPostcode,
    deliveryPostcode,
    pickupLat: Number(pickupGeocode.latitude),
    pickupLng: Number(pickupGeocode.longitude),
    deliveryLat: Number(deliveryGeocode.latitude),
    deliveryLng: Number(deliveryGeocode.longitude),
    distanceKm: Number(created.distanceKm),
    durationSeconds: created.durationSeconds,
    provider: created.provider,
    calculationMethod: created.calculationMethod,
  };
}

async function getOrCreatePostcodeGeocode(normalizedPostcode: string) {
  const existing = await prisma.postcodeGeocode.findUnique({
    where: { normalizedPostcode },
  });
  if (existing) return existing;

  const response = await fetch(
    `${POSTCODES_BASE_URL}/postcodes/${encodeURIComponent(normalizedPostcode)}`,
  );
  if (!response.ok) {
    throw new Error(`Could not geocode postcode ${displayUkPostcode(normalizedPostcode)}.`);
  }

  const body = (await response.json()) as {
    result?: {
      postcode?: string;
      latitude?: number;
      longitude?: number;
      quality?: number;
      eastings?: number | null;
      northings?: number | null;
    };
  };
  const result = body.result;
  if (!result?.latitude || !result.longitude) {
    throw new Error(`No geocode returned for ${displayUkPostcode(normalizedPostcode)}.`);
  }

  return prisma.postcodeGeocode.create({
    data: {
      normalizedPostcode,
      displayPostcode: result.postcode ?? displayUkPostcode(normalizedPostcode),
      latitude: result.latitude,
      longitude: result.longitude,
      provider: POSTCODE_PROVIDER,
      providerPlaceId: result.postcode,
      quality: {
        quality: result.quality,
        eastings: result.eastings,
        northings: result.northings,
      },
    },
  });
}

async function calculateRoadRoute(params: {
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
}) {
  if (ROUTING_PROVIDER !== "osrm") {
    throw new Error(`Unsupported ROUTING_PROVIDER: ${ROUTING_PROVIDER}`);
  }

  const url =
    `${OSRM_BASE_URL}/route/v1/driving/` +
    `${params.pickupLng},${params.pickupLat};${params.deliveryLng},${params.deliveryLat}` +
    "?overview=false&alternatives=false&steps=false";
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Could not calculate road distance for the postcode pair.");
  }

  const body = (await response.json()) as {
    routes?: Array<{ distance?: number; duration?: number; weight_name?: string }>;
  };
  const route = body.routes?.[0];
  if (!route?.distance) {
    throw new Error("Routing provider did not return a road distance.");
  }

  return {
    distanceKm: route.distance / 1000,
    durationSeconds: route.duration ? Math.round(route.duration) : null,
    provider: "osrm",
    providerRouteId: null,
    calculationMethod: "road_route",
  };
}

function hashRoute(
  organizationId: string,
  pickupPostcode: string,
  deliveryPostcode: string,
) {
  return createHash("sha256")
    .update([organizationId, pickupPostcode, deliveryPostcode, ROUTING_PROVIDER].join(":"))
    .digest("hex");
}
