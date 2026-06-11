import { readFileSync } from "node:fs";

type VercelEnvTarget = "production" | "preview" | "development";

const envFile = process.argv[2] ?? "Import.env";
const target = (process.argv[3] ?? "production") as VercelEnvTarget;
const token = process.env.VERCEL_TOKEN;
const projectId = process.env.VERCEL_PROJECT_ID;
const teamId = process.env.VERCEL_TEAM_ID ?? process.env.VERCEL_ORG_ID;

if (!token) fail("VERCEL_TOKEN is required.");
if (!projectId) fail("VERCEL_PROJECT_ID is required.");
if (!["production", "preview", "development"].includes(target)) {
  fail('Target must be "production", "preview", or "development".');
}

const entries = parseEnvFile(readFileSync(envFile, "utf8"));
const unresolved = entries.filter((entry) => entry.value.includes("__REPLACE"));
if (unresolved.length) {
  fail(
    `Resolve placeholders before pushing env vars: ${unresolved
      .map((entry) => entry.key)
      .join(", ")}`,
  );
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});

async function main() {
  for (const entry of entries) {
    await upsertEnv(entry.key, entry.value);
  }

  console.log(`Applied ${entries.length} Vercel ${target} env vars from ${envFile}.`);
}

function parseEnvFile(contents: string) {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      if (separator <= 0) fail(`Invalid env line: ${line}`);
      const key = line.slice(0, separator).trim();
      const value = stripQuotes(line.slice(separator + 1).trim());
      if (!key) fail(`Invalid env key in line: ${line}`);
      return { key, value };
    });
}

function stripQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

async function upsertEnv(key: string, value: string) {
  const existing = await findExistingEnv(key);
  if (existing) {
    await vercelFetch(`/v10/projects/${projectId}/env/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify({ value, target: [target], type: "encrypted" }),
    });
    console.log(`Updated ${key}`);
    return;
  }

  await vercelFetch(`/v10/projects/${projectId}/env`, {
    method: "POST",
    body: JSON.stringify({ key, value, target: [target], type: "encrypted" }),
  });
  console.log(`Created ${key}`);
}

async function findExistingEnv(key: string) {
  const response = await vercelFetch(`/v10/projects/${projectId}/env`);
  const body = (await response.json()) as {
    envs?: Array<{ id: string; key: string; target?: string[] }>;
  };
  return body.envs?.find((env) => env.key === key && env.target?.includes(target));
}

async function vercelFetch(path: string, init?: RequestInit) {
  const url = new URL(`https://api.vercel.com${path}`);
  if (teamId) url.searchParams.set("teamId", teamId);

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    fail(`Vercel API ${response.status} ${response.statusText}: ${body}`);
  }

  return response;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
