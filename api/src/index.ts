import { Queue } from "bullmq";
import { Redis } from "ioredis";
import {
  QUEUE_NAME,
  createLogger,
  redisConnection,
  type JobData,
  type JobResult,
} from "@app/shared";
import { createApp } from "./app";

const log = createLogger("api");

const PORT = Number(process.env.PORT ?? 3000);

const queue = new Queue<JobData, JobResult>(QUEUE_NAME, {
  connection: redisConnection(),
});
queue.on("error", (err) => log.error({ err: err.message }, "queue error"));

const redis = new Redis(redisConnection());
redis.on("error", (err) => log.error({ err: err.message }, "redis error"));

const app = createApp({ queue, redis });

const server = app.listen(PORT, () => log.info(`api on :${PORT}`));

let closing = false;

function shutdown(exitCode: number): void {
  if (closing) return;
  closing = true;
  const timer = setTimeout(() => process.exit(exitCode), 10_000);
  timer.unref();
  server.close(() => {
    void (async () => {
      await queue.close();
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

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));
