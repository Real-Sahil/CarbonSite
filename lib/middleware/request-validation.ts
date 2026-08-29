import { NextRequest, NextResponse } from "next/server";
import { z, ZodSchema } from "zod";

/**
 * Validate request body against a Zod schema.
 * Returns parsed data or error response.
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: ZodSchema
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  try {
    const body = await request.json();
    const parsed = schema.parse(body);
    return { data: parsed as T, error: null };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        data: null,
        error: NextResponse.json(
          {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            errors: err.errors.map((e) => ({
              path: e.path.join("."),
              message: e.message,
              code: e.code,
            })),
          },
          { status: 400 }
        ),
      };
    }

    if (err instanceof SyntaxError) {
      return {
        data: null,
        error: NextResponse.json(
          {
            code: "INVALID_JSON",
            message: "Request body must be valid JSON",
          },
          { status: 400 }
        ),
      };
    }

    return {
      data: null,
      error: NextResponse.json(
        {
          code: "REQUEST_ERROR",
          message: "Failed to parse request",
        },
        { status: 400 }
      ),
    };
  }
}

/**
 * Validate query parameters against a Zod schema.
 */
export function validateQueryParams<T>(
  request: NextRequest,
  schema: ZodSchema
): { data: T; error: null } | { data: null; error: NextResponse } {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = schema.parse(params);
    return { data: parsed as T, error: null };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        data: null,
        error: NextResponse.json(
          {
            code: "VALIDATION_ERROR",
            message: "Query parameter validation failed",
            errors: err.errors.map((e) => ({
              path: e.path.join("."),
              message: e.message,
              code: e.code,
            })),
          },
          { status: 400 }
        ),
      };
    }

    return {
      data: null,
      error: NextResponse.json(
        {
          code: "QUERY_ERROR",
          message: "Failed to parse query parameters",
        },
        { status: 400 }
      ),
    };
  }
}

/**
 * Create a Zod schema validator that also validates input types.
 * Useful for ensuring numbers/booleans are parsed correctly from query strings.
 */
export const StrictQuerySchema = {
  string: z.string().trim(),
  number: z.coerce.number(),
  integer: z.coerce.number().int(),
  boolean: z.enum(["true", "false"]).transform((val) => val === "true"),
  date: z.string().datetime(),
  enum: <T extends readonly string[]>(values: T) =>
    z.enum(values as unknown as [string, ...string[]]),
  optional: <T extends ZodSchema>(schema: T) => schema.optional(),
  array: (schema: ZodSchema) =>
    z.string().transform((val) => val.split(",").map((s) => s.trim())).pipe(
      z.array(schema)
    ),
};
