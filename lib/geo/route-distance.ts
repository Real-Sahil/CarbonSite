import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

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

export class RouteDistanceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 422,
  ) {
    super(message);
  }
}

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
    throw new RouteDistanceError(
      "INVALID_POSTCODE_FORMAT",
      "Pickup and delivery postcodes must be valid UK postcode formats.",
      422,
    );
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
    throw new RouteDistanceError(
      "POSTCODE_NOT_FOUND",
      `Could not geocode postcode ${displayUkPostcode(normalizedPostcode)}.`,
      422,
    );
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
    throw new RouteDistanceError(
      "POSTCODE_NOT_FOUND",
      `No geocode returned for ${displayUkPostcode(normalizedPostcode)}.`,
      422,
    );
  }

  const displayPostcode = result.postcode ?? displayUkPostcode(normalizedPostcode);

  // Encrypt postcodes for at-rest data protection (GDPR compliance)
  const { encryptField } = await import("@/lib/security/field-encryption");
  let normalizedEncrypted: Record<string, unknown> | undefined;
  let displayEncrypted: Record<string, unknown> | undefined;
  try {
    normalizedEncrypted = encryptField(normalizedPostcode) as Record<string, unknown>;
    displayEncrypted = encryptField(displayPostcode) as Record<string, unknown>;
  } catch (err) {
    // If encryption fails, continue without encrypted fields (graceful degradation)
    console.warn(
      `[postcode-geocoding] Encryption failed, storing unencrypted: ${err}`,
    );
  }

  return prisma.postcodeGeocode.create({
    data: {
      normalizedPostcode,
      displayPostcode,
      normalizedPostcodeEncrypted: (normalizedEncrypted ?? Prisma.DbNull) as Prisma.InputJsonValue,
      displayPostcodeEncrypted: (displayEncrypted ?? Prisma.DbNull) as Prisma.InputJsonValue,
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
    throw new RouteDistanceError(
      "UNSUPPORTED_ROUTING_PROVIDER",
      `Unsupported ROUTING_PROVIDER: ${ROUTING_PROVIDER}`,
      500,
    );
  }

  const url =
    `${OSRM_BASE_URL}/route/v1/driving/` +
    `${params.pickupLng},${params.pickupLat};${params.deliveryLng},${params.deliveryLat}` +
    "?overview=false&alternatives=false&steps=false";
  const response = await fetch(url);
  if (!response.ok) {
    throw new RouteDistanceError(
      "ROUTE_DISTANCE_UNAVAILABLE",
      "Could not calculate road distance for the postcode pair.",
      502,
    );
  }

  const body = (await response.json()) as {
    routes?: Array<{ distance?: number; duration?: number; weight_name?: string }>;
  };
  const route = body.routes?.[0];
  if (!route?.distance) {
    throw new RouteDistanceError(
      "ROUTE_DISTANCE_UNAVAILABLE",
      "Routing provider did not return a road distance.",
      502,
    );
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

export type DistrictDistance = { km: number | null; method: string };

/**
 * Road km from the centre of a postcode district (outward code, e.g. "HD9")
 * to a full site postcode, for commuting. The district's centre comes from
 * postcodes.io's outcode lookup and is cached like a postcode; the route is
 * cached per organisation like any other. When the router is unavailable the
 * straight-line distance x 1.3 is used and not cached, so a later import
 * retries the road route. An unknown district gives no distance.
 */
export async function getDistrictRoadKm(params: {
  organizationId: string;
  district: string;
  sitePostcode: string;
}): Promise<DistrictDistance> {
  const district = normalizeUkPostcode(params.district);
  const site = normalizeUkPostcode(params.sitePostcode);
  if (!/^[A-Z]{1,2}\d[A-Z\d]?$/.test(district)) return { km: null, method: "not a postcode district" };
  if (!isLikelyUkPostcode(site)) {
    throw new RouteDistanceError("INVALID_POSTCODE_FORMAT", "The site needs a full UK postcode.", 422);
  }

  const routeHash = hashRoute(params.organizationId, district, site);
  const existing = await prisma.routeDistance.findUnique({ where: { routeHash } });
  if (existing) return { km: Number(existing.distanceKm), method: existing.calculationMethod };

  const [from, to] = await Promise.all([getOrCreateDistrictGeocode(district), getOrCreatePostcodeGeocode(site)]);
  if (!from) return { km: null, method: "district not found" };

  const coords = {
    pickupLat: Number(from.latitude),
    pickupLng: Number(from.longitude),
    deliveryLat: Number(to.latitude),
    deliveryLng: Number(to.longitude),
  };
  let route;
  try {
    route = await calculateRoadRoute(coords);
  } catch {
    return { km: Math.round(greatCircleKm(coords) * 1.3 * 10) / 10, method: "straight line x 1.3 (router unavailable)" };
  }
  await prisma.routeDistance.create({
    data: {
      organizationId: params.organizationId,
      pickupPostcode: district,
      deliveryPostcode: site,
      pickupGeocodeId: from.id,
      deliveryGeocodeId: to.id,
      distanceKm: route.distanceKm,
      durationSeconds: route.durationSeconds,
      provider: route.provider,
      providerRouteId: route.providerRouteId,
      routeHash,
      calculationMethod: `district_centre_${route.calculationMethod}`,
    },
  });
  return { km: route.distanceKm, method: `district_centre_${route.calculationMethod}` };
}

async function getOrCreateDistrictGeocode(district: string) {
  const existing = await prisma.postcodeGeocode.findUnique({ where: { normalizedPostcode: district } });
  if (existing) return existing;
  const response = await fetch(`${POSTCODES_BASE_URL}/outcodes/${encodeURIComponent(district)}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new RouteDistanceError("POSTCODE_LOOKUP_UNAVAILABLE", "The postcode lookup is unavailable. Try again shortly.", 502);
  }
  const body = (await response.json()) as { result?: { outcode?: string; latitude?: number; longitude?: number } };
  if (!body.result?.latitude || !body.result.longitude) return null;
  return prisma.postcodeGeocode.upsert({
    where: { normalizedPostcode: district },
    create: {
      normalizedPostcode: district,
      displayPostcode: body.result.outcode ?? district,
      latitude: body.result.latitude,
      longitude: body.result.longitude,
      provider: `${POSTCODE_PROVIDER} outcode`,
      providerPlaceId: body.result.outcode ?? district,
    },
    update: {},
  });
}

function greatCircleKm(p: { pickupLat: number; pickupLng: number; deliveryLat: number; deliveryLng: number }) {
  const rad = Math.PI / 180;
  const dLat = (p.deliveryLat - p.pickupLat) * rad;
  const dLng = (p.deliveryLng - p.pickupLng) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(p.pickupLat * rad) * Math.cos(p.deliveryLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
