import { verifyEnvironmentConfiguration } from "../lib/env/verify";

const result = verifyEnvironmentConfiguration();

if (!result.ok) {
  for (const error of result.errors) {
    console.error(error);
  }

  if (result.missing.length > 0) {
    console.error(
      `Missing required environment variables: ${result.missing.join(", ")}`,
    );
  }

  process.exit(1);
}

console.log("Environment configuration looks complete for MetricOra.");
