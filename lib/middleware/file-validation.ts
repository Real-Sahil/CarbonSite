import { NextRequest, NextResponse } from "next/server";

export interface FileValidationConfig {
  maxSize: number; // bytes
  allowedMimeTypes: string[];
  maxFiles?: number;
}

const DEFAULT_CONFIGS = {
  csv: {
    maxSize: 25 * 1024 * 1024, // 25 MB
    allowedMimeTypes: ["text/csv", "application/vnd.ms-excel"],
  },
  excel: {
    maxSize: 25 * 1024 * 1024, // 25 MB
    allowedMimeTypes: [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  },
  image: {
    maxSize: 10 * 1024 * 1024, // 10 MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  pdf: {
    maxSize: 20 * 1024 * 1024, // 20 MB
    allowedMimeTypes: ["application/pdf"],
  },
  document: {
    maxSize: 15 * 1024 * 1024, // 15 MB
    allowedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ],
  },
};

/**
 * Validate a file from FormData.
 * Returns error response if validation fails, null if valid.
 */
export async function validateFormDataFile(
  file: File,
  config: FileValidationConfig
): Promise<NextResponse | null> {
  // Check file size
  if (file.size > config.maxSize) {
    return NextResponse.json(
      {
        code: "FILE_TOO_LARGE",
        message: `File size exceeds maximum of ${formatBytes(config.maxSize)}`,
        maxSize: config.maxSize,
      },
      { status: 400 }
    );
  }

  // Check MIME type
  if (!config.allowedMimeTypes.includes(file.type)) {
    return NextResponse.json(
      {
        code: "INVALID_FILE_TYPE",
        message: `File type ${file.type} not allowed. Accepted types: ${config.allowedMimeTypes.join(", ")}`,
        allowedTypes: config.allowedMimeTypes,
      },
      { status: 400 }
    );
  }

  return null;
}

/**
 * Validate multiple files from FormData.
 */
export async function validateFormDataFiles(
  files: File[],
  config: FileValidationConfig
): Promise<NextResponse | null> {
  // Check file count
  if (config.maxFiles && files.length > config.maxFiles) {
    return NextResponse.json(
      {
        code: "TOO_MANY_FILES",
        message: `Maximum ${config.maxFiles} files allowed`,
        maxFiles: config.maxFiles,
      },
      { status: 400 }
    );
  }

  // Validate each file
  for (const file of files) {
    const error = await validateFormDataFile(file, config);
    if (error) {
      return error;
    }
  }

  return null;
}

/**
 * Extract and validate a single file from FormData.
 */
export async function extractAndValidateFile(
  formData: FormData,
  fieldName: string,
  config: FileValidationConfig
): Promise<{ file: File; error: null } | { file: null; error: NextResponse }> {
  const file = formData.get(fieldName) as File | null;

  if (!file) {
    return {
      file: null,
      error: NextResponse.json(
        {
          code: "MISSING_FILE",
          message: `File field "${fieldName}" is required`,
        },
        { status: 400 }
      ),
    };
  }

  const validationError = await validateFormDataFile(file, config);
  if (validationError) {
    return { file: null, error: validationError };
  }

  return { file, error: null };
}

/**
 * Extract and validate multiple files from FormData.
 */
export async function extractAndValidateFiles(
  formData: FormData,
  fieldName: string,
  config: FileValidationConfig
): Promise<
  | { files: File[]; error: null }
  | { files: null; error: NextResponse }
> {
  const entries = formData.getAll(fieldName) as File[];

  if (!entries || entries.length === 0) {
    return {
      files: null,
      error: NextResponse.json(
        {
          code: "MISSING_FILES",
          message: `File field "${fieldName}" is required`,
        },
        { status: 400 }
      ),
    };
  }

  const validationError = await validateFormDataFiles(entries, config);
  if (validationError) {
    return { files: null, error: validationError };
  }

  return { files: entries, error: null };
}

/**
 * Validate file name to prevent directory traversal attacks.
 */
export function validateFileName(fileName: string): boolean {
  // Reject paths with directory separators or null bytes
  if (
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\") ||
    fileName.includes("\0")
  ) {
    return false;
  }

  // Reject empty names
  if (!fileName || fileName.trim().length === 0) {
    return false;
  }

  return true;
}

/**
 * Sanitize file name for safe storage.
 */
export function sanitizeFileName(fileName: string): string {
  // Remove any path components
  let name = fileName.split(/[/\\]/).pop() || "file";

  // Remove null bytes
  name = name.replace(/\0/g, "");

  // Replace spaces with underscores
  name = name.replace(/\s+/g, "_");

  // Remove special characters
  name = name.replace(/[^a-zA-Z0-9._-]/g, "");

  // Ensure it's not empty
  if (!name || name.length === 0) {
    name = "upload";
  }

  return name;
}

/**
 * Format bytes as human-readable string.
 */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

export { DEFAULT_CONFIGS as FileValidationPresets };
