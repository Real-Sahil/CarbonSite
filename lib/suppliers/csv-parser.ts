import { parse } from "csv-parse/sync";

export interface SupplierImportRow {
  email: string;
  name: string;
  company?: string;
  tags?: string;
  categoryAssignments?: string;
}

export interface ParsedSupplierRow extends SupplierImportRow {
  rowNumber: number;
  errors?: string[];
}

export interface BulkImportResult {
  success: ParsedSupplierRow[];
  failed: Array<{
    rowNumber: number;
    data: Partial<SupplierImportRow>;
    errors: string[];
  }>;
}

export function parseSupplierCsv(buffer: Buffer): ParsedSupplierRow[] {
  let csv: SupplierImportRow[];

  try {
    csv = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as SupplierImportRow[];
  } catch (err) {
    throw new Error(`CSV parsing failed: ${err instanceof Error ? err.message : "Unknown error"}`);
  }

  if (!csv || csv.length === 0) {
    throw new Error("CSV file is empty or invalid");
  }

  return csv.map((row, index) => ({
    ...row,
    rowNumber: index + 2, // Row numbers start at 2 (1 is header)
  }));
}

export function validateSupplierRows(
  rows: ParsedSupplierRow[],
  orgId: string,
): BulkImportResult {
  const result: BulkImportResult = {
    success: [],
    failed: [],
  };

  for (const row of rows) {
    const errors: string[] = [];

    // Validate email
    if (!row.email || !row.email.trim()) {
      errors.push("Email is required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      errors.push("Email format is invalid");
    }

    // Validate name
    if (!row.name || !row.name.trim()) {
      errors.push("Name is required");
    } else if (row.name.length > 255) {
      errors.push("Name must be 255 characters or less");
    }

    // Validate company (optional)
    if (row.company && row.company.length > 255) {
      errors.push("Company name must be 255 characters or less");
    }

    // Validate tags format (comma-separated)
    if (row.tags && row.tags.trim()) {
      const tagList = row.tags.split(",").map((t) => t.trim());
      if (tagList.some((t) => t.length === 0 || t.length > 100)) {
        errors.push("Tags must be non-empty and 100 characters or less each");
      }
    }

    // Validate category assignments (semicolon-separated category codes)
    if (row.categoryAssignments && row.categoryAssignments.trim()) {
      const categoryList = row.categoryAssignments.split(";").map((c) => c.trim());
      if (categoryList.some((c) => !c.match(/^s[1-3]-[\w-]+$/))) {
        errors.push("Category codes must be in format s1-code, s2-code, or s3-code");
      }
    }

    if (errors.length > 0) {
      result.failed.push({
        rowNumber: row.rowNumber,
        data: row,
        errors,
      });
    } else {
      result.success.push(row);
    }
  }

  return result;
}

export function formatCategoryAssignments(categoryStr?: string): string[] {
  if (!categoryStr || !categoryStr.trim()) {
    return [];
  }
  return categoryStr.split(";").map((c) => c.trim());
}

export function formatTags(tagStr?: string): string[] {
  if (!tagStr || !tagStr.trim()) {
    return [];
  }
  return tagStr.split(",").map((t) => t.trim());
}
