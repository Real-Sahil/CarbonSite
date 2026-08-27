/**
 * API Version Discovery Endpoint
 * GET /_meta/versions
 *
 * Returns information about available API versions and their status.
 * No authentication required.
 */

import { NextResponse } from "next/server";

const API_VERSIONS = [
  {
    version: "1.0",
    status: "stable",
    releaseDate: "2024-07-01",
    sunsetDate: "2025-02-01",
    deprecated: false,
    description: "Current stable API with offset-based pagination",
    features: ["Offset-based pagination", "Bearer token auth", "Core emissions tracking"],
  },
  {
    version: "2.0",
    status: "coming-soon",
    releaseDate: "2024-12-01",
    deprecated: false,
    description: "Next-generation API with cursor-based pagination and WebSocket support",
    features: ["Cursor-based pagination", "WebSocket real-time updates", "Batch operations"],
    breaking: [
      "Pagination format changed from offset to cursor",
      "Removed /api/v1/legacy/* endpoints",
    ],
  },
];

export async function GET() {
  return NextResponse.json({
    versions: API_VERSIONS,
    current: "1.0",
    latest: "2.0",
    info: {
      documentation: "https://docs.carbonsite.app/api",
      status: "https://status.carbonsite.app",
      support: "support@carbonsite.app",
    },
  });
}
