/**
 * Natural England MAGIC (Multi-Agency Geographic Information for the Countryside)
 * Served via DEFRA's environment.data.gov.uk ArcGIS REST services — free, no auth.
 *
 * Designated site types queried:
 *   - SSSI (Sites of Special Scientific Interest)
 *   - SAC (Special Areas of Conservation)
 *   - SPA (Special Protection Areas)
 *   - NNR (National Nature Reserves)
 *   - Ancient Woodland Inventory
 *
 * Also queries the Forestry Commission National Forest Inventory via
 * the same open ArcGIS endpoint.
 */

export interface DesignatedSite {
  name: string;
  type: "SSSI" | "SAC" | "SPA" | "NNR" | "AncientWoodland" | string;
  distanceKm: number | null;
  areaSqKm: number | null;
  notifiedOn: string | null;
  condition: string | null;
}

export interface WoodlandParcel {
  name: string;
  type: string;
  areaHa: number;
  ifc: string | null;
}

export interface MagicScanResult {
  designatedSites: DesignatedSite[];
  sssiCount: number;
  sacCount: number;
  spaCount: number;
  nvrCount: number;
  ancientWoodlandCount: number;
  woodlandData: WoodlandParcel[];
  woodlandTotalHa: number;
  broadleafHa: number;
  coniferHa: number;
  mixedWoodlandHa: number;
}

const DEFRA_BASE = "https://environment.data.gov.uk/arcgis/rest/services";
const FC_BASE = "https://opendata.forestresearch.gov.uk/arcgis/rest/services";
const TIMEOUT = 20_000;

const LAYER_URLS: Record<string, string> = {
  SSSI:            `${DEFRA_BASE}/NE/SitesOfSpecialScientificInterestEngland/FeatureServer/0`,
  SAC:             `${DEFRA_BASE}/NE/SpecialAreasOfConservationEngland/FeatureServer/0`,
  SPA:             `${DEFRA_BASE}/NE/SpecialProtectionAreasEngland/FeatureServer/0`,
  NNR:             `${DEFRA_BASE}/NE/NationalNatureReservesEngland/FeatureServer/0`,
  AncientWoodland: `${DEFRA_BASE}/NE/AncientWoodlandEngland/FeatureServer/0`,
};

const FC_NFI_URL = `${FC_BASE}/Forestry/NFIWoodlandEngland/FeatureServer/0`;

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface ArcGISFeatureResponse {
  features?: Array<{
    attributes?: Record<string, unknown>;
  }>;
}

function buildArcGISQuery(layerUrl: string, lat: number, lon: number, radiusM: number): string {
  const geometry = encodeURIComponent(JSON.stringify({
    x: lon, y: lat,
    spatialReference: { wkid: 4326 },
  }));
  return (
    `${layerUrl}/query?` +
    `geometry=${geometry}` +
    `&geometryType=esriGeometryPoint` +
    `&inSR=4326&outSR=4326` +
    `&spatialRel=esriSpatialRelIntersects` +
    `&distance=${radiusM}&units=esriSRUnit_Meter` +
    `&outFields=*&returnGeometry=false&f=json`
  );
}

function safeStr(val: unknown): string | null {
  return val != null && val !== "" ? String(val) : null;
}

function safeNum(val: unknown): number | null {
  const n = Number(val);
  return isNaN(n) ? null : n;
}

export async function scanDesignatedSitesAndWoodland(
  lat: number,
  lon: number,
  radiusKm: number = 5,
): Promise<MagicScanResult> {
  const radiusM = radiusKm * 1000;

  // Fan out all layer queries in parallel — each query is independent.
  const [sssiData, sacData, spaData, nnrData, awData, fcData] = await Promise.all([
    fetchJson<ArcGISFeatureResponse>(buildArcGISQuery(LAYER_URLS.SSSI, lat, lon, radiusM)),
    fetchJson<ArcGISFeatureResponse>(buildArcGISQuery(LAYER_URLS.SAC, lat, lon, radiusM)),
    fetchJson<ArcGISFeatureResponse>(buildArcGISQuery(LAYER_URLS.SPA, lat, lon, radiusM)),
    fetchJson<ArcGISFeatureResponse>(buildArcGISQuery(LAYER_URLS.NNR, lat, lon, radiusM)),
    fetchJson<ArcGISFeatureResponse>(buildArcGISQuery(LAYER_URLS.AncientWoodland, lat, lon, radiusM)),
    fetchJson<ArcGISFeatureResponse>(buildArcGISQuery(FC_NFI_URL, lat, lon, radiusM)),
  ]);

  const designatedSites: DesignatedSite[] = [];

  // Resolve the first non-null value for a list of candidate field names.
  // DEFRA ArcGIS layers have inconsistent capitalisation across service versions.
  function pickField(attrs: Record<string, unknown>, ...candidates: string[]): unknown {
    for (const c of candidates) {
      const val = attrs[c] ?? attrs[c.toUpperCase()] ?? attrs[c.toLowerCase()];
      if (val != null && val !== "") return val;
    }
    return null;
  }

  function parseSites(
    data: ArcGISFeatureResponse | null,
    type: string,
    nameFields: string[],
    dateFields?: string[],
    conditionFields?: string[],
    areaFields?: string[],
  ) {
    for (const f of data?.features ?? []) {
      const a = f.attributes ?? {};
      designatedSites.push({
        name: safeStr(pickField(a, ...nameFields)) ?? "Unknown",
        type,
        distanceKm: null,
        areaSqKm: areaFields ? safeNum(pickField(a, ...areaFields)) : null,
        notifiedOn: dateFields ? safeStr(pickField(a, ...dateFields)) : null,
        condition: conditionFields ? safeStr(pickField(a, ...conditionFields)) : null,
      });
    }
  }

  // Field name variants observed across DEFRA ArcGIS service versions.
  parseSites(sssiData, "SSSI",
    ["SSSI_NAME", "sssi_name", "SITENAME", "NAME"],
    ["NOTIFICATION_DATE", "NOTIFIED_DATE"],
    ["CONDITION", "SSSI_CONDITION_SUMMARY", "CONDITION_SUMMARY"],
  );
  parseSites(sacData, "SAC",
    ["SAC_NAME", "siteName", "NAME"],
    ["DATE_CONFIRMED", "CONFIRMATION_DATE"],
  );
  parseSites(spaData, "SPA",
    ["SPA_NAME", "siteName", "NAME"],
    ["DATE_CONFIRMED", "CLASSIFICATION_DATE"],
  );
  parseSites(nnrData, "NNR",
    ["NNR_NAME", "siteName", "NAME"],
    ["NOTIFICATION_DATE", "NOTIFIED_DATE"],
  );
  // Ancient Woodland Inventory — DEFRA uses AW_NAME; fallback to NAME for older snapshots.
  parseSites(awData, "AncientWoodland",
    ["AW_NAME", "NAME", "WOODLAND_NAME"],
    undefined, undefined,
    ["AREA_HA", "AREA", "Shape_Area"],
  );

  const woodlandData: WoodlandParcel[] = [];
  let woodlandTotalHa = 0;
  let broadleafHa = 0;
  let coniferHa = 0;
  let mixedWoodlandHa = 0;

  for (const f of fcData?.features ?? []) {
    const a = f.attributes ?? {};
    const areaHa = safeNum(a["TOTAL_HA"] ?? a["AREA_HA"] ?? a["Shape_Area"]) ?? 0;
    const type = safeStr(a["IWS_CATEGORY"] ?? a["CATEGORY"]) ?? "Woodland";
    const ifc = safeStr(a["IFC_STATUS"]);
    woodlandData.push({
      name: safeStr(a["NAME"]) ?? "Unnamed woodland",
      type,
      areaHa,
      ifc,
    });
    woodlandTotalHa += areaHa;
    const lower = type.toLowerCase();
    if (lower.includes("broadleav") || lower.includes("broadleaf")) broadleafHa += areaHa;
    else if (lower.includes("conifer")) coniferHa += areaHa;
    else mixedWoodlandHa += areaHa;
  }

  return {
    designatedSites,
    sssiCount: sssiData?.features?.length ?? 0,
    sacCount:  sacData?.features?.length ?? 0,
    spaCount:  spaData?.features?.length ?? 0,
    nvrCount:  nnrData?.features?.length ?? 0,
    ancientWoodlandCount: awData?.features?.length ?? 0,
    woodlandData,
    woodlandTotalHa,
    broadleafHa,
    coniferHa,
    mixedWoodlandHa,
  };
}
