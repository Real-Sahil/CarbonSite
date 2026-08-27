/**
 * Valhalla Routing Client
 * Advanced supply chain analytics: time matrices, isochrones, map-matching
 *
 * Reference: https://valhalla.readthedocs.io/
 * License: MIT (FOSSGIS e.V.)
 *
 * Use Cases:
 * - Supplier delivery time estimation (location.json → matrix.json)
 * - Geographic coverage analysis (isochrones)
 * - Field worker route correction (map-matching GPS traces)
 * - Waste collection route optimization
 */

export type Location = {
  lat: number;
  lon: number;
  name?: string;
};

export type TimeMatrixResult = {
  status: "success" | "error";
  sources: Location[];
  targets: Location[];
  matrix: {
    // Time in seconds between each source and target
    times: number[][];
    // Distance in meters between each source and target
    distances: number[][];
  };
  error?: string;
};

export type IsochroneResult = {
  status: "success" | "error";
  center: Location;
  // GeoJSON polygon of reachable area
  polygon?: {
    type: "Polygon";
    coordinates: number[][][];
  };
  properties?: {
    contour: number; // Time in minutes
    color: string; // Hex color for visualization
  };
  error?: string;
};

export type MapMatchResult = {
  status: "success" | "error";
  // Corrected GPS trace
  matchedTrace: Location[];
  // Confidence of match (0-1)
  confidence: number;
  error?: string;
};

/**
 * Valhalla HTTP client for routing analytics
 */
export class ValhallaClient {
  private apiUrl: string;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(apiUrl?: string, timeoutMs = 10000, maxRetries = 3) {
    this.apiUrl = apiUrl || process.env.VALHALLA_API_URL || "http://localhost:8002";
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
  }

  /**
   * Get time/distance matrix between multiple locations
   * Useful for: supplier delivery time estimation, route optimization
   *
   * Example: Estimate delivery times from 3 suppliers to 5 facilities
   */
  async getTimeMatrix(input: {
    sources: Location[];
    targets: Location[];
    costing?: "auto" | "bicycle" | "pedestrian" | "taxi"; // Default: "auto"
  }): Promise<TimeMatrixResult> {
    if (input.sources.length === 0 || input.targets.length === 0) {
      return {
        status: "error",
        sources: [],
        targets: [],
        matrix: { times: [], distances: [] },
        error: "Sources and targets must not be empty",
      };
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.callValhallaApi("matrix", {
          sources: input.sources.map((l) => ({ lat: l.lat, lon: l.lon })),
          targets: input.targets.map((l) => ({ lat: l.lat, lon: l.lon })),
          costing: input.costing || "auto",
          format: "json",
        });

        return {
          status: "success",
          sources: input.sources,
          targets: input.targets,
          matrix: {
            times: (response.sources_to_targets as Array<Array<{ time: number }>>).map((row) =>
              row.map((cell) => cell.time)
            ),
            distances: (response.sources_to_targets as Array<Array<{ distance: number }>>).map((row) =>
              row.map((cell) => cell.distance)
            ),
          },
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < this.maxRetries - 1) {
          const delayMs = Math.pow(2, attempt) * 100;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    return {
      status: "error",
      sources: input.sources,
      targets: input.targets,
      matrix: { times: [], distances: [] },
      error: lastError?.message || "Time matrix request failed after retries",
    };
  }

  /**
   * Generate isochrone (area reachable within time/distance)
   * Useful for: supplier coverage analysis, geographic service areas
   *
   * Example: What area can supplier reach within 2 hours?
   */
  async getIsochrone(input: {
    center: Location;
    contourMinutes: number; // e.g., 30, 60, 120
    costing?: "auto" | "bicycle" | "pedestrian";
  }): Promise<IsochroneResult> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.callValhallaApi("isochrone", {
          locations: [{ lat: input.center.lat, lon: input.center.lon }],
          contours: [{ time: input.contourMinutes }],
          costing: input.costing || "auto",
          denoise: 1,
          format: "geojson",
        });

        interface IsochroneGeometry {
          type: "Polygon";
          coordinates: number[][][];
        }

        const features = (response.features as Array<{ geometry: IsochroneGeometry }>) || [];
        const polygon = features[0]?.geometry;

        return {
          status: "success",
          center: input.center,
          polygon,
          properties: {
            contour: input.contourMinutes,
            color: this.getContourColor(input.contourMinutes),
          },
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < this.maxRetries - 1) {
          const delayMs = Math.pow(2, attempt) * 100;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    return {
      status: "error",
      center: input.center,
      error: lastError?.message || "Isochrone request failed after retries",
    };
  }

  /**
   * Match GPS trace to road network
   * Useful for: field worker route correction, GPS drift compensation
   *
   * Example: Smooth field worker's GPS route to actual roads
   */
  async mapMatchTrace(input: {
    trace: Location[];
    costing?: "auto" | "bicycle" | "pedestrian";
  }): Promise<MapMatchResult> {
    if (input.trace.length < 2) {
      return {
        status: "error",
        matchedTrace: [],
        confidence: 0,
        error: "Trace must have at least 2 points",
      };
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.callValhallaApi("match", {
          shape: input.trace.map((l) => ({ lat: l.lat, lon: l.lon })),
          costing: input.costing || "auto",
          format: "json",
        });

        interface MatchedPoint {
          lat: number;
          lon: number;
          edge_index: number;
        }

        const matchedTrace =
          (response.matched_points as MatchedPoint[] | undefined)?.map((p) => ({
            lat: p.lat,
            lon: p.lon,
            name: `Matched ${p.edge_index}`,
          })) || [];

        // Confidence based on match quality
        const confidence = Math.min(
          1.0,
          ((response.matched_points as MatchedPoint[] | undefined)?.length || 0) / (input.trace.length || 1)
        );

        return {
          status: "success",
          matchedTrace,
          confidence,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < this.maxRetries - 1) {
          const delayMs = Math.pow(2, attempt) * 100;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    return {
      status: "error",
      matchedTrace: [],
      confidence: 0,
      error: lastError?.message || "Map match request failed after retries",
    };
  }

  /**
   * Health check for Valhalla service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/health`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async callValhallaApi(endpoint: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.apiUrl}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Valhalla API error: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as Record<string, unknown>;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private getContourColor(minutes: number): string {
    // Color gradient for isochrone visualization
    if (minutes <= 15) return "#00FF00"; // Green: <15 min
    if (minutes <= 30) return "#FFFF00"; // Yellow: <30 min
    if (minutes <= 60) return "#FF8C00"; // Orange: <60 min
    return "#FF0000"; // Red: >60 min
  }
}

/**
 * Supply chain analytics using Valhalla time matrices
 */
export type SupplierDeliveryAnalysis = {
  supplier: Location;
  facilities: Location[];
  avgDeliveryTimeMin: number;
  maxDeliveryTimeMin: number;
  minDeliveryTimeMin: number;
  coverageCount: number; // Facilities within 2-hour window
  coverage2HourPct: number;
};

export async function analyzeSupplierCoverage(
  client: ValhallaClient,
  supplier: Location,
  facilities: Location[],
): Promise<SupplierDeliveryAnalysis> {
  const matrix = await client.getTimeMatrix({
    sources: [supplier],
    targets: facilities,
  });

  if (matrix.status !== "success" || matrix.matrix.times.length === 0) {
    return {
      supplier,
      facilities,
      avgDeliveryTimeMin: 0,
      maxDeliveryTimeMin: 0,
      minDeliveryTimeMin: 0,
      coverageCount: 0,
      coverage2HourPct: 0,
    };
  }

  const times = matrix.matrix.times[0] || [];
  const timesMins = times.map((s) => s / 60);

  const coverageCount = timesMins.filter((t) => t <= 120).length;

  return {
    supplier,
    facilities,
    avgDeliveryTimeMin: timesMins.reduce((a, b) => a + b, 0) / timesMins.length,
    maxDeliveryTimeMin: Math.max(...timesMins),
    minDeliveryTimeMin: Math.min(...timesMins),
    coverageCount,
    coverage2HourPct: (coverageCount / facilities.length) * 100,
  };
}
