import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import * as XLSX from "xlsx";

type Params = { params: Promise<{ orgId: string }> };

const TEMPLATE_HEADERS = [
  "Amount",
  "Unit",
  "Category Code",
  "Activity Date",
  "Start Date",
  "End Date",
  "Source Description",
  "Facility",
  "Business Unit",
  "Supplier",
  "Country",
  "Region",
  "Fuel Type",
  "Transport Mode",
  "Refrigerant Type",
  "Distance",
  "Distance Unit",
  "Spend Amount",
  "Spend Currency",
  "Scope 2 Method",
  "Assumption Notes",
];

const EXAMPLE_ROW = [
  "100",
  "kWh",
  "s2-electricity-lb",
  "2025-01-15",
  "",
  "",
  "Office electricity — Q1",
  "Head Office",
  "Operations",
  "UK National Grid",
  "GB",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "location_based",
  "",
];

const CATEGORY_CODES = [
  "s1-stationary",
  "s1-mobile",
  "s1-fugitive",
  "s2-electricity-lb",
  "s2-electricity-mb",
  "s3-business-travel",
  "s3-commuting",
  "s3-purchased-goods",
  "s3-upstream-transport",
];

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer");

    const wb = XLSX.utils.book_new();

    // Main data sheet with headers + one example row
    const dataWs = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, EXAMPLE_ROW]);
    XLSX.utils.book_append_sheet(wb, dataWs, "Import Data");

    // Reference sheet with valid category codes
    const refRows: string[][] = [
      ["Category Code", "Description", "Scope"],
      ["s1-stationary", "Stationary combustion (boilers, furnaces)", "1"],
      ["s1-mobile", "Mobile combustion (fleet vehicles)", "1"],
      ["s1-fugitive", "Fugitive emissions (refrigerants)", "1"],
      ["s2-electricity-lb", "Electricity — location-based", "2"],
      ["s2-electricity-mb", "Electricity — market-based", "2"],
      ["s3-business-travel", "Business travel (flights, rail, taxi)", "3"],
      ["s3-commuting", "Employee commuting", "3"],
      ["s3-purchased-goods", "Purchased goods and services", "3"],
      ["s3-upstream-transport", "Upstream transport and distribution", "3"],
    ];
    const refWs = XLSX.utils.aoa_to_sheet(refRows);
    XLSX.utils.book_append_sheet(wb, refWs, "Category Codes");

    const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="carbonsite-import-template.xlsx"',
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// Export category codes for use in the import form UI
export const VALID_CATEGORY_CODES = CATEGORY_CODES;
