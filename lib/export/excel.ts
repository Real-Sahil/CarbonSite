import * as XLSX from "xlsx";

export interface ExcelWorksheetConfig {
  name: string;
  data: Array<Record<string, unknown>>;
  autoWidth?: boolean;
  freezePane?: { row: number; col: number };
  headerStyle?: boolean;
}

export interface ExcelStyleConfig {
  bold?: boolean;
  fontSize?: number;
  bgColor?: string;
  fontColor?: string;
  border?: boolean;
  alignment?: "left" | "center" | "right";
  numberFormat?: string;
}

/**
 * Convert data array to XLSX workbook with multiple sheets.
 * Returns Buffer containing Excel file.
 */
export function generateExcelWorkbook(
  sheets: ExcelWorksheetConfig[],
  fileName: string = "export"
): Buffer {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.data);

    // Set column widths if autoWidth is enabled
    if (sheet.autoWidth && sheet.data.length > 0) {
      const columnWidths: number[] = [];

      // Get all keys from first row
      const firstRow = sheet.data[0];
      for (const key of Object.keys(firstRow)) {
        const maxLength = Math.max(
          key.length,
          ...sheet.data.map((row) => {
            const value = row[key];
            return String(value || "").length;
          })
        );
        columnWidths.push(Math.min(maxLength + 2, 50));
      }

      worksheet["!cols"] = columnWidths.map((w) => ({ wch: w }));
    }

    // Apply header styling (bold background)
    if (sheet.headerStyle && sheet.data.length > 0) {
      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!worksheet[cellAddress]) continue;

        worksheet[cellAddress].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "366092" } },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          },
        };
      }
    }

    // Freeze panes if specified
    if (sheet.freezePane) {
      worksheet["!freeze"] = {
        xSplit: sheet.freezePane.col,
        ySplit: sheet.freezePane.row,
        topLeftCell:
          sheet.freezePane.col > 0 || sheet.freezePane.row > 0
            ? XLSX.utils.encode_cell({
                r: sheet.freezePane.row,
                c: sheet.freezePane.col,
              })
            : undefined,
      };
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }

  // Write to buffer
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/**
 * Input shapes for export functions — typed to fields actually accessed.
 */
export interface ActivityRecordInput {
  id: string;
  createdAt: string | Date;
  category?: string | { name?: string; code?: string } | null;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  reviewStatus?: string | null;
  evidenceStatus?: string | null;
  totalCo2e?: number | null;
  facility?: { name?: string } | null;
  businessUnit?: { name?: string } | null;
  importBatch?: unknown;
}

export interface DashboardAggregateInput {
  period?: { name?: string } | null;
  scope1Total?: { toNumber(): number } | number | null;
  scope2Total?: { toNumber(): number } | number | null;
  scope3Total?: { toNumber(): number } | number | null;
  totalCo2e?: { toNumber(): number } | number | null;
  recordCount?: { toNumber(): number } | number | null;
  dataQualityPercent?: { toNumber(): number } | number | null;
}

export interface CategoryBreakdownInput {
  category?: { name?: string; code?: string } | null;
  emissionCategory?: { name?: string; code?: string } | null;
  totalCo2e?: number | null;
  recordCount?: number | null;
}

/**
 * Generate activity records export with emissions calculations.
 */
export interface ActivityRecordExportRow {
  [key: string]: unknown;
  "Record ID": string;
  "Creation Date": string;
  "Category": string;
  "Description": string;
  "Quantity": number;
  "Unit": string;
  "Review Status": string;
  "Evidence Status": string;
  "Total CO₂e (kg)": number;
  "Scope": string;
  "Facility": string | null;
  "Business Unit": string | null;
  "Source": string;
}

/**
 * Format activity records for Excel export.
 */
function resolveCategory(category: ActivityRecordInput["category"]): { name: string; code: string } {
  if (!category) return { name: "Unknown", code: "" };
  if (typeof category === "string") return { name: category, code: "" };
  return { name: category.name || "Unknown", code: category.code || "" };
}

export function formatActivityRecordsForExport(
  records: ActivityRecordInput[]
): ActivityRecordExportRow[] {
  return records.map((record) => {
    const cat = resolveCategory(record.category);
    return {
    "Record ID": record.id,
    "Creation Date": new Date(record.createdAt).toLocaleDateString(),
    "Category": cat.name,
    "Description": record.description || "",
    "Quantity": record.quantity || 0,
    "Unit": record.unit || "",
    "Review Status": record.reviewStatus?.replace(/_/g, " ") || "Unknown",
    "Evidence Status": record.evidenceStatus?.replace(/_/g, " ") || "Unknown",
    "Total CO₂e (kg)": record.totalCo2e || 0,
    "Scope": cat.code.split("-")[0]?.toUpperCase() || "Unknown",
    "Facility": record.facility?.name || null,
    "Business Unit": record.businessUnit?.name || null,
    "Source": record.importBatch ? "Import" : "Manual Entry",
    };
  });
}

/**
 * Dashboard aggregates export with scope and category breakdown.
 */
export interface DashboardExportRow {
  [key: string]: unknown;
  "Period": string;
  "Scope 1 (kg CO₂e)": number;
  "Scope 2 (kg CO₂e)": number;
  "Scope 3 (kg CO₂e)": number;
  "Total (kg CO₂e)": number;
  "Records Count": number;
  "Data Quality %": number;
}

/**
 * Format dashboard aggregates for Excel export.
 */
function toNum(v: { toNumber(): number } | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return v.toNumber();
}

export function formatDashboardForExport(
  aggregates: DashboardAggregateInput[]
): DashboardExportRow[] {
  return aggregates.map((agg) => ({
    "Period": agg.period?.name || "Unknown",
    "Scope 1 (kg CO₂e)": toNum(agg.scope1Total),
    "Scope 2 (kg CO₂e)": toNum(agg.scope2Total),
    "Scope 3 (kg CO₂e)": toNum(agg.scope3Total),
    "Total (kg CO₂e)": toNum(agg.totalCo2e),
    "Records Count": toNum(agg.recordCount),
    "Data Quality %": toNum(agg.dataQualityPercent),
  }));
}

/**
 * Emissions by category export.
 */
export interface CategoryExportRow {
  [key: string]: unknown;
  "Category": string;
  "Category Code": string;
  "Scope": string;
  "Total CO₂e (kg)": number;
  "Record Count": number;
  "Average per Record (kg)": number;
  "% of Total": number;
}

/**
 * Format emissions by category for Excel export.
 */
export function formatCategoryBreakdownForExport(
  categories: CategoryBreakdownInput[],
  totalEmissions: number
): CategoryExportRow[] {
  return categories.map((cat) => {
    const catData = cat.category ?? cat.emissionCategory;
    return {
    "Category": catData?.name || "Unknown",
    "Category Code": catData?.code || "",
    "Scope": catData?.code?.split("-")[0]?.toUpperCase() || "Unknown",
    "Total CO₂e (kg)": cat.totalCo2e || 0,
    "Record Count": cat.recordCount || 0,
    "Average per Record (kg)":
      (cat.recordCount || 0) > 0
        ? (cat.totalCo2e || 0) / (cat.recordCount || 1)
        : 0,
    "% of Total":
      totalEmissions > 0
        ? Math.round(((cat.totalCo2e || 0) / totalEmissions) * 100 * 100) / 100
        : 0,
  };
  });
}

/**
 * Generate a complete compliance/audit report workbook.
 */
export async function generateComplianceReportWorkbook(
  orgName: string,
  periodName: string,
  activityRecords: ActivityRecordInput[],
  dashboardData: DashboardAggregateInput[],
  categoryData: CategoryBreakdownInput[],
  totalEmissions: number
): Promise<Buffer> {
  const sheets: ExcelWorksheetConfig[] = [
    {
      name: "Summary",
      data: [
        {
          "Organization": orgName,
          "Reporting Period": periodName,
          "Total Emissions (kg CO₂e)": Math.round(totalEmissions),
          "Report Generated": new Date().toLocaleString(),
          "Methodology Version": "GHG Protocol v2026-01",
        },
      ],
      headerStyle: true,
    },
    {
      name: "Activity Records",
      data: formatActivityRecordsForExport(activityRecords),
      autoWidth: true,
      headerStyle: true,
      freezePane: { row: 1, col: 0 },
    },
    {
      name: "By Category",
      data: formatCategoryBreakdownForExport(categoryData, totalEmissions),
      autoWidth: true,
      headerStyle: true,
      freezePane: { row: 1, col: 0 },
    },
    {
      name: "Dashboard Summary",
      data: formatDashboardForExport(dashboardData),
      autoWidth: true,
      headerStyle: true,
      freezePane: { row: 1, col: 0 },
    },
  ];

  return generateExcelWorkbook(sheets, `${orgName}_report`);
}
