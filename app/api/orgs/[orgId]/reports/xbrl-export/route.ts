export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { validateApiKey } from "@/lib/auth/api-key";
import { apiError, handleRouteError } from "@/lib/validation/api";

const XbrlExportSchema = z.object({
  snapshotId: z.string().min(1).describe("PublishedSnapshot ID to export as iXBRL"),
});

/**
 * GET /api/orgs/[orgId]/reports/xbrl-export?snapshotId=...
 * Export report data as iXBRL (inline XBRL) for CSRD/ESRS digital tagging.
 *
 * iXBRL is XBRL tags embedded in HTML, allowing human-readable reports
 * with machine-readable tags for regulatory compliance and data extraction.
 *
 * Supports EU Taxonomy CSRD/ESRS requirements for digital sustainability reporting.
 * References XBRL Sustainability Reporting Specification (SRS).
 *
 * Authentication: API key
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;

    // Authenticate via API key
    let authenticatedOrgId: string;
    try {
      authenticatedOrgId = await validateApiKey(req.headers.get("authorization"));
    } catch (err) {
      return apiError("UNAUTHORIZED", "Invalid API key", 401);
    }

    // Ensure the key belongs to the requested org
    if (authenticatedOrgId !== orgId) {
      return apiError("FORBIDDEN", "API key does not belong to this organization", 403);
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const query = XbrlExportSchema.safeParse({
      snapshotId: searchParams.get("snapshotId"),
    });

    if (!query.success) {
      return apiError("VALIDATION_ERROR", "Invalid query parameters", 400, query.error.flatten());
    }

    const { snapshotId } = query.data;

    // Fetch the published snapshot
    const snapshot = await prisma.publishedSnapshot.findUnique({
      where: { id: snapshotId },
      select: {
        id: true,
        organizationId: true,
        version: true,
        publishedAt: true,
        reportingPeriod: {
          select: {
            label: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    if (!snapshot || snapshot.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Snapshot not found", 404);
    }

    // Fetch dashboard aggregates
    const aggregates = await prisma.dashboardAggregate.findMany({
      where: {
        organizationId: orgId,
        snapshotId,
      },
      select: {
        scope: true,
        totalCo2e: true,
        emissionCategory: {
          select: { code: true, name: true },
        },
      },
    });

    // Calculate scope totals
    const scopeTotals = aggregates.reduce(
      (acc: Record<number, number>, a) => {
        acc[a.scope] = (acc[a.scope] || 0) + (Number(a.totalCo2e) || 0);
        return acc;
      },
      {},
    );

    // Generate iXBRL HTML with embedded XBRL tags
    const ixbrlHtml = generateIxbrlHtml(
      snapshot,
      aggregates,
      scopeTotals,
      orgId,
    );

    return new NextResponse(ixbrlHtml, {
      headers: {
        "Content-Type": "application/xhtml+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="report-xbrl-${Date.now()}.xhtml"`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * Generate iXBRL (inline XBRL) HTML with embedded sustainability tags.
 * Maps GHG Protocol scopes to XBRL GL (Global Ledger) taxonomy for CSRD/ESRS.
 */
function generateIxbrlHtml(
  snapshot: any,
  aggregates: any[],
  scopeTotals: Record<number, number>,
  orgId: string,
): string {
  const reportDate = snapshot.publishedAt ? new Date(snapshot.publishedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

  // Calculate total
  const totalCo2e = Object.values(scopeTotals).reduce((sum: number, val: number) => sum + val, 0);

  const ixbrl = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN"
  "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xmlns:xbrli="http://xbrl.org/2003/instance"
      xmlns:xbrldi="http://xbrl.org/2006/xbrldi"
      xmlns:es-nfrs="http://xbrl.org/taxonomy/esef/esef_core"
      xmlns:ix="http://www.sec.gov/cgi-bin/viewer"
      xmlns:ixt="http://www.sec.gov/inlineXBRL/transformation/v2"
      xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
      xmlns:gc="http://xbrl.org/2006/genericLabel"
      xmlns:gl="http://xbrl.org/gl/2008-12-31"
      xsi:schemaLocation="http://www.sec.gov/cgi-bin/viewer http://www.sec.gov/cgi-bin/viewer">
<head>
  <meta charset="UTF-8"/>
  <title>Greenhouse Gas Emissions Report - iXBRL Format</title>
  <meta name="report-date" content="${reportDate}"/>
  <meta name="organization-id" content="${orgId}"/>
  <meta name="snapshot-version" content="${snapshot.version}"/>
</head>
<body>
  <h1>Greenhouse Gas Emissions Report (iXBRL)</h1>

  <section>
    <h2>Reporting Period</h2>
    <p>${snapshot.reportingPeriod.label}</p>
    <p>From ${formatDate(snapshot.reportingPeriod.startDate)} to ${formatDate(snapshot.reportingPeriod.endDate)}</p>
  </section>

  <section>
    <h2>Emission Summary (Tonnes CO2e)</h2>

    <table border="1" cellpadding="5">
      <thead>
        <tr>
          <th>Scope</th>
          <th>Value (tonnes CO2e)</th>
          <th>XBRL Concept</th>
        </tr>
      </thead>
      <tbody>
        ${
          Object.entries(scopeTotals).map(([scope, value]) => {
            const scopeNum = parseInt(scope);
            const xbrlConcept = getXbrlConceptForScope(scopeNum);
            return `
        <tr>
          <td>Scope ${scopeNum}</td>
          <td>
            <ix:nonfraction
              contextRef="instant_${reportDate}"
              name="${xbrlConcept}"
              unitRef="tonnes_co2e"
              decimals="2">${Number(value).toFixed(2)}</ix:nonfraction>
          </td>
          <td>${xbrlConcept}</td>
        </tr>
            `;
          }).join('')
        }
        <tr style="font-weight: bold;">
          <td>Total Scope 1-3</td>
          <td>
            <ix:nonfraction
              contextRef="instant_${reportDate}"
              name="es-nfrs:DirectGHGEmissions"
              unitRef="tonnes_co2e"
              decimals="2">${totalCo2e.toFixed(2)}</ix:nonfraction>
          </td>
          <td>DirectGHGEmissions</td>
        </tr>
      </tbody>
    </table>
  </section>

  <section>
    <h2>Category Breakdown</h2>
    <table border="1" cellpadding="5">
      <thead>
        <tr>
          <th>Category</th>
          <th>Scope</th>
          <th>CO2e (tonnes)</th>
          <th>XBRL Mapping</th>
        </tr>
      </thead>
      <tbody>
        ${
          aggregates.map((a) => {
            const xbrlCategory = getXbrlCategoryMapping(a.emissionCategory?.code || 'other');
            return `
        <tr>
          <td>${a.emissionCategory?.name || 'Other'}</td>
          <td>${a.scope}</td>
          <td>
            <ix:nonfraction
              contextRef="instant_${reportDate}"
              name="${xbrlCategory}"
              unitRef="tonnes_co2e"
              decimals="2">${Number(a.totalCo2e).toFixed(2)}</ix:nonfraction>
          </td>
          <td>${xbrlCategory}</td>
        </tr>
            `;
          }).join('')
        }
      </tbody>
    </table>
  </section>

  <section>
    <h2>XBRL Metadata</h2>
    <p>This document contains inline XBRL (iXBRL) tags for regulatory reporting.</p>
    <p>XBRL Specification Version: 3.0</p>
    <p>Taxonomy: ESEF Sustainability Reporting (ES-NFRS)</p>
    <p>Reporting Framework: GHG Protocol</p>
    <p>Report Generated: ${new Date().toISOString()}</p>
  </section>

  <!-- XBRL Instance Context and Unit Definitions -->
  <div style="display:none;">
    <ix:header>
      <ix:hidden>
        <xbrli:xbrl>
          <!-- Contexts -->
          <xbrli:context id="instant_${reportDate}">
            <xbrli:entity>
              <xbrli:identifier scheme="http://www.sec.gov/cik">${orgId}</xbrli:identifier>
            </xbrli:entity>
            <xbrli:period>
              <xbrli:instant>${reportDate}</xbrli:instant>
            </xbrli:period>
          </xbrli:context>

          <!-- Units -->
          <xbrli:unit id="tonnes_co2e">
            <xbrli:measure>tonnes_co2e</xbrli:measure>
          </xbrli:unit>
        </xbrli:xbrl>
      </ix:hidden>
    </ix:header>
  </div>

</body>
</html>`;

  return ixbrl;
}

/**
 * Get XBRL GL concept for GHG Protocol scope.
 */
function getXbrlConceptForScope(scope: number): string {
  const mapping: Record<number, string> = {
    1: "es-nfrs:DirectGHGEmissions", // Scope 1
    2: "es-nfrs:EnergyIndirectGHGEmissions", // Scope 2
    3: "es-nfrs:OtherIndirectGHGEmissions", // Scope 3
  };
  return mapping[scope] || "es-nfrs:OtherIndirectGHGEmissions";
}

/**
 * Map emission category codes to XBRL sustainability concepts.
 */
function getXbrlCategoryMapping(categoryCode: string): string {
  const mapping: Record<string, string> = {
    "s1-stationary": "es-nfrs:DirectGHGEmissions",
    "s1-mobile": "es-nfrs:DirectGHGEmissions",
    "s1-fugitive": "es-nfrs:DirectGHGEmissions",
    "s2-electricity-lb": "es-nfrs:EnergyIndirectGHGEmissions",
    "s2-electricity-mb": "es-nfrs:EnergyIndirectGHGEmissions",
    "s3-business-travel": "es-nfrs:OtherIndirectGHGEmissions",
    "s3-commuting": "es-nfrs:OtherIndirectGHGEmissions",
    "s3-purchased-goods": "es-nfrs:OtherIndirectGHGEmissions",
    "s3-upstream-transport": "es-nfrs:OtherIndirectGHGEmissions",
  };
  return mapping[categoryCode] || "es-nfrs:OtherIndirectGHGEmissions";
}

/**
 * Format date to YYYY-MM-DD.
 */
function formatDate(date: string | Date): string {
  if (typeof date === "string") {
    return date.split('T')[0];
  }
  return new Date(date).toISOString().split('T')[0];
}
