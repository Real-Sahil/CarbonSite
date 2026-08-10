export interface SupabaseError {
  code: string;
  message: string;
  details?: string;
  status?: number;
}

export function parseSupabaseError(error: unknown): SupabaseError {
  if (error && typeof error === "object" && "code" in error && "message" in error) {
    const err = error as any;
    return {
      code: err.code || "UNKNOWN_ERROR",
      message: err.message || "An unknown error occurred",
      details: err.details,
      status: err.status,
    };
  }

  if (error && typeof error === "object" && "status" in error) {
    const err = error as any;
    return {
      code: `HTTP_${err.status}`,
      message: err.message || `HTTP Error ${err.status}`,
      details: err.details,
      status: err.status,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: typeof error === "string" ? error : "An unknown error occurred",
  };
}

export function handleSupabaseError(error: unknown): {
  action: "logout" | "show_error" | "retry";
  message: string;
} {
  const parsedError = parseSupabaseError(error);

  // 401: Session expired or invalid
  if (parsedError.status === 401 || parsedError.code === "PGRST301") {
    return {
      action: "logout",
      message: "Your session has expired. Please log in again.",
    };
  }

  // 403: Permission denied (RLS policy blocked access)
  if (parsedError.status === 403) {
    return {
      action: "show_error",
      message: "You do not have permission to perform this action. Please contact your administrator.",
    };
  }

  // 400: Validation error
  if (parsedError.status === 400) {
    return {
      action: "show_error",
      message: parsedError.message || "Invalid request. Please check your input.",
    };
  }

  // 409: Conflict (unique constraint, etc.)
  if (parsedError.status === 409) {
    return {
      action: "show_error",
      message: parsedError.message || "A conflict occurred. Please try again.",
    };
  }

  // 5xx: Server error
  if (parsedError.status && parsedError.status >= 500) {
    return {
      action: "retry",
      message: "Server error. Please try again in a moment.",
    };
  }

  // Default: Show error, don't retry or logout
  return {
    action: "show_error",
    message: parsedError.message || "An error occurred. Please try again.",
  };
}
