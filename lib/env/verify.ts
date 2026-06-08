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
  const routeProvider = env.ROUTING_PROVIDER ?? "osrm";
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
