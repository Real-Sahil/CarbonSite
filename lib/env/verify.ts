export type EnvironmentMode = {
  emailDriver: string;
  jobProcessingMode: string;
  routeProvider: string;
  storageDriver: string;
};

export type EnvironmentVerification = {
  errors: string[];
  missing: string[];
  mode: EnvironmentMode;
  ok: boolean;
  required: string[];
};

type EnvSource = Record<string, string | undefined>;

const BASE_REQUIRED = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "TRUSTED_ORIGINS",
  "NEXT_PUBLIC_APP_URL",
  "STORAGE_DRIVER",
  "EMAIL_DRIVER",
  "JOB_PROCESSING_MODE",
];

export function verifyEnvironmentConfiguration(
  env: EnvSource = process.env,
): EnvironmentVerification {
  const required = [...BASE_REQUIRED];
  const storageDriver = env.STORAGE_DRIVER ?? "";
  const emailDriver = env.EMAIL_DRIVER ?? "";
  const jobProcessingMode = env.JOB_PROCESSING_MODE ?? "";
  const nodeEnv = env.NODE_ENV ?? "";
  const routeProvider = env.ROUTING_PROVIDER ?? "osrm";
  const requireEmailVerification = env.BETTER_AUTH_REQUIRE_EMAIL_VERIFICATION?.trim();
  const errors: string[] = [];

  if (storageDriver === "r2") {
    required.push(
      "STORAGE_ENDPOINT",
      "STORAGE_ACCESS_KEY_ID",
      "STORAGE_SECRET_ACCESS_KEY",
      "STORAGE_BUCKET",
    );
  }

  if (emailDriver === "resend") {
    required.push("RESEND_API_KEY", "EMAIL_FROM");
  }

  if (routeProvider === "osrm") {
    required.push("POSTCODES_BASE_URL", "OSRM_BASE_URL");
  }

  if (!["inline", "worker"].includes(jobProcessingMode)) {
    errors.push(
      `JOB_PROCESSING_MODE must be "inline" or "worker"; received "${jobProcessingMode || "unset"}".`,
    );
  }

  if (!["local", "r2"].includes(storageDriver)) {
    errors.push(
      `STORAGE_DRIVER must be "local" or "r2"; received "${storageDriver || "unset"}".`,
    );
  }

  if (!["console", "resend"].includes(emailDriver)) {
    errors.push(
      `EMAIL_DRIVER must be "console" or "resend"; received "${emailDriver || "unset"}".`,
    );
  }

  if (
    requireEmailVerification &&
    !["true", "false"].includes(requireEmailVerification)
  ) {
    errors.push(
      `BETTER_AUTH_REQUIRE_EMAIL_VERIFICATION must be "true" or "false"; received "${requireEmailVerification}".`,
    );
  }

  if (nodeEnv === "production") {
    if (storageDriver === "local") {
      errors.push('STORAGE_DRIVER must be "r2" when NODE_ENV=production.');
    }
    if (emailDriver === "console") {
      errors.push('EMAIL_DRIVER must be "resend" when NODE_ENV=production.');
    }
    if (!isHttpsUrl(env.BETTER_AUTH_URL)) {
      errors.push("BETTER_AUTH_URL must be an HTTPS URL when NODE_ENV=production.");
    }
    if (!isHttpsUrl(env.NEXT_PUBLIC_APP_URL)) {
      errors.push("NEXT_PUBLIC_APP_URL must be an HTTPS URL when NODE_ENV=production.");
    }
    if (!hasMinimumSecretEntropy(env.BETTER_AUTH_SECRET)) {
      errors.push("BETTER_AUTH_SECRET must be at least 32 characters when NODE_ENV=production.");
    }
    for (const origin of parseOrigins(env.TRUSTED_ORIGINS)) {
      if (!isHttpsUrl(origin)) {
        errors.push("TRUSTED_ORIGINS must contain only HTTPS origins when NODE_ENV=production.");
        break;
      }
    }
  }

  const missing = required.filter((key) => !hasValue(env[key]));

  return {
    errors,
    missing,
    mode: {
      emailDriver,
      jobProcessingMode,
      routeProvider,
      storageDriver,
    },
    ok: errors.length === 0 && missing.length === 0,
    required,
  };
}

function hasValue(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasMinimumSecretEntropy(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length >= 32;
}

function isHttpsUrl(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return false;
  try {
    return new URL(trimmed).protocol === "https:";
  } catch {
    return false;
  }
}

function parseOrigins(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return [];
  return trimmed
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
