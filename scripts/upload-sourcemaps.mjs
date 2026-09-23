// Uploads browser source maps to Sentry after `next build`, then deletes them
// from the build output so they are never served publicly. Runs only when
// SENTRY_AUTH_TOKEN is set (Vercel project env), otherwise does nothing.
// A failed upload never fails the deploy: readable stack traces are nice to
// have, the release is not.
import { execFileSync } from "node:child_process";
import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

if (!process.env.SENTRY_AUTH_TOKEN) {
  console.log("[sourcemaps] SENTRY_AUTH_TOKEN not set, skipping upload.");
  process.exit(0);
}

const org = process.env.SENTRY_ORG ?? "metricora";
const project = process.env.SENTRY_PROJECT ?? "metricora";
const dir = ".next/static";
const bin = join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "sentry-cli.cmd" : "sentry-cli");
const cli = (...args) =>
  execFileSync(bin, args, { stdio: "inherit", env: { ...process.env, SENTRY_URL: process.env.SENTRY_URL ?? "https://de.sentry.io/" } });

try {
  cli("sourcemaps", "inject", dir);
  cli("sourcemaps", "upload", "--org", org, "--project", project, ...(process.env.VERCEL_GIT_COMMIT_SHA ? ["--release", process.env.VERCEL_GIT_COMMIT_SHA] : []), dir);
} catch (err) {
  console.warn("[sourcemaps] Upload failed; the deploy continues without readable browser stack traces.", err.message);
}

let removed = 0;
const walk = (d) => {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".map")) { rmSync(p); removed++; }
  }
};
walk(dir);
console.log(`[sourcemaps] Removed ${removed} source map files from the public build.`);
