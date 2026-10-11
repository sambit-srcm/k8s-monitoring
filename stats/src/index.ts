import { Queue } from "bullmq";
import { Redis } from "ioredis";
import {
  QUEUE_NAME,
  createLogger,
  redisConnection,
  type JobData,
  type JobResult,
} from "@app/shared";
import { createStatsApp, type StatsQueue, type StatsRedis } from "./app";

const log = createLogger("stats");

const PORT = Number(process.env.PORT ?? 3100);

const connection = {
  ...redisConnection(),
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
};

const queue = new Queue<JobData, JobResult>(QUEUE_NAME, { connection });
queue.on("error", (err) => log.error({ err: err.message }, "queue error"));

const redis = new Redis(connection);
redis.on("error", (err) => log.error({ err: err.message }, "redis error"));

const app = createStatsApp({
  redis: redis as unknown as StatsRedis,
  queue: queue as unknown as StatsQueue,
});

const server = app.listen(PORT, () => log.info(`stats on :${PORT}`));

let closing = false;

function shutdown(exitCode: number): void {
  if (closing) return;
  closing = true;
  const timer = setTimeout(() => process.exit(exitCode), 10_000);
  timer.unref();
  server.close(() => {
    void (async () => {
      await queue.close().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "queue close failed";
        log.error({ err: message }, "queue close failed");
      });
      redis.disconnect();
      clearTimeout(timer);
      process.exit(exitCode);
    })();
  });
}

process.on("unhandledRejection", (err) => {
  log.error({ err }, "unhandledRejection");
  shutdown(1);
});

process.on("uncaughtException", (err) => {
  log.error({ err }, "uncaughtException");
  shutdown(1);
});

process.on("SIGTERM", async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await queue.close().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : "queue close failed";
    log.error({ err: message }, "queue close failed");
  });
  redis.disconnect();
  process.exit(0);
});
