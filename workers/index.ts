// BullMQ worker entry point — run as a separate process: pnpm worker
// This process never handles HTTP requests.

import { Worker, type ConnectionOptions } from "bullmq";

const connection: ConnectionOptions = { url: process.env.REDIS_URL! };

async function processImport(job: { data: unknown }) {
  console.log("[imports] Processing job:", job.data);
  // TODO: parse → validate → stage → produce error CSV
}

async function processCalculation(job: { data: unknown }) {
  console.log("[calculations] Processing job:", job.data);
  // TODO: normalize units → select factor → compute → persist EmissionCalculation → rebuild DashboardAggregate
}

async function processReport(job: { data: unknown }) {
  console.log("[reports] Processing job:", job.data);
  // TODO: Puppeteer PDF from published snapshot → upload to R2 with checksum
}

async function processNotification(job: { data: unknown }) {
  console.log("[notifications] Processing job:", job.data);
  // TODO: email fan-out via SMTP
}

const workers = [
  new Worker("imports", processImport, { connection, concurrency: 2 }),
  new Worker("calculations", processCalculation, { connection, concurrency: 4 }),
  new Worker("reports", processReport, { connection, concurrency: 1 }),
  new Worker("notifications", processNotification, { connection, concurrency: 5 }),
];

workers.forEach((w) => {
  w.on("failed", (job, err) => console.error(`[${w.name}] job ${job?.id} failed:`, err.message));
  w.on("completed", (job) => console.log(`[${w.name}] job ${job.id} completed`));
});

console.log("Workers started:", workers.map((w) => w.name).join(", "));
