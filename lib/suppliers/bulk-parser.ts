import { parse } from 'csv-parse/sync';

export interface BulkSupplierRow {
  email: string;
  name?: string;
  notes?: string;
  categoryCode?: string;
}

export interface BulkParseResult {
  valid: BulkSupplierRow[];
  errors: Array<{
    rowIndex: number;
    email?: string;
    reason: string;
  }>;
  summary: {
    totalRows: number;
    validCount: number;
    errorCount: number;
  };
}

export function parseBulkSupplierCSV(fileContent: string): BulkParseResult {
  const errors: BulkParseResult['errors'] = [];
  const valid: BulkSupplierRow[] = [];

  try {
    // Parse CSV with flexible parsing
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
    }) as Record<string, string>[];

    records.forEach((record, rowIndex) => {
      const row: BulkSupplierRow = {
        email: (record.email || record.Email || record.EMAIL || '').toLowerCase().trim(),
        name: (record.name || record.Name || record.NAME || '').trim() || undefined,
        notes: (record.notes || record.Notes || record.NOTES || '').trim() || undefined,
        categoryCode: (record.categoryCode || record.category_code || record.CategoryCode || '').trim() || undefined,
      };

      // Validate email
      if (!row.email) {
        errors.push({
          rowIndex: rowIndex + 2, // +2 because of 1-based indexing and header row
          reason: 'Email is required',
        });
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(row.email)) {
        errors.push({
          rowIndex: rowIndex + 2,
          email: row.email,
          reason: 'Invalid email format',
        });
        return;
      }

      // Validate name length
      if (row.name && row.name.length > 200) {
        errors.push({
          rowIndex: rowIndex + 2,
          email: row.email,
          reason: 'Supplier name exceeds 200 characters',
        });
        return;
      }

      // Validate notes length
      if (row.notes && row.notes.length > 1000) {
        errors.push({
          rowIndex: rowIndex + 2,
          email: row.email,
          reason: 'Notes exceed 1000 characters',
        });
        return;
      }

      // Check for duplicate emails in same batch
      if (valid.some((v) => v.email === row.email)) {
        errors.push({
          rowIndex: rowIndex + 2,
          email: row.email,
          reason: 'Duplicate email in batch',
        });
        return;
      }

      valid.push(row);
    });

    return {
      valid,
      errors,
      summary: {
        totalRows: records.length,
        validCount: valid.length,
        errorCount: errors.length,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      valid: [],
      errors: [
        {
          rowIndex: 0,
          reason: `CSV parsing failed: ${message}`,
        },
      ],
      summary: {
        totalRows: 0,
        validCount: 0,
        errorCount: 1,
      },
    };
  }
}
