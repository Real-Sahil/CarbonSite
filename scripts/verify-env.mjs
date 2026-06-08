const required = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "TRUSTED_ORIGINS",
  "NEXT_PUBLIC_APP_URL",
  "STORAGE_DRIVER",
  "EMAIL_DRIVER",
  "JOB_PROCESSING_MODE",
];

const storageDriver = process.env.STORAGE_DRIVER ?? "";
const emailDriver = process.env.EMAIL_DRIVER ?? "";
const jobMode = process.env.JOB_PROCESSING_MODE ?? "";
const routeProvider = process.env.ROUTING_PROVIDER ?? "osrm";

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

if (!["inline", "worker"].includes(jobMode)) {
  fail(`JOB_PROCESSING_MODE must be "inline" or "worker"; received "${jobMode || "unset"}".`);
}

if (!["local", "r2"].includes(storageDriver)) {
  fail(`STORAGE_DRIVER must be "local" or "r2"; received "${storageDriver || "unset"}".`);
}

if (!["console", "resend"].includes(emailDriver)) {
  fail(`EMAIL_DRIVER must be "console" or "resend"; received "${emailDriver || "unset"}".`);
}

const missing = required.filter((key) => !hasValue(process.env[key]));

if (missing.length > 0) {
  fail(`Missing required environment variables: ${missing.join(", ")}`);
}

console.log("Environment configuration looks complete for CarbonSite.");

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
