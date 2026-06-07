import { Queue, type ConnectionOptions } from "bullmq";

// Pass URL string — avoids ioredis version conflicts between direct dep and BullMQ's bundled dep
const connection: ConnectionOptions = { url: process.env.REDIS_URL! };

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
};

export { connection as redisConnection };

export const importsQueue = new Queue("imports", { connection, defaultJobOptions });
export const calculationsQueue = new Queue("calculations", { connection, defaultJobOptions });
export const reportsQueue = new Queue("reports", { connection, defaultJobOptions });
export const notificationsQueue = new Queue("notifications", {
  connection,
  defaultJobOptions: { attempts: 5, backoff: { type: "exponential" as const, delay: 1000 } },
});
