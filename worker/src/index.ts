import { Worker } from "bullmq";
import {
  QUEUE_NAME,
  createLogger,
  redisConnection,
  type JobData,
  type JobResult,
} from "@app/shared";
import { processJob, closeStats } from "./processor";
import { startMetricsServer } from "./server";

const log = createLogger("worker");

const METRICS_PORT = Number(process.env.METRICS_PORT ?? 9100);

const worker = new Worker<JobData, JobResult>(QUEUE_NAME, processJob, {
  connection: redisConnection(),
  concurrency: 1,
});

worker.on("error", (err) => log.error({ err: err.message }, "worker error"));
worker.on("completed", (job) => log.info({ id: job.id, type: job.data.type }, "done"));
worker.on("failed", (job, err) => log.info({ id: job?.id, err: err.message }, "failed"));

const server = startMetricsServer(METRICS_PORT);

let closing = false;

function shutdown(exitCode: number): void {
  if (closing) return;
  closing = true;
  const timer = setTimeout(() => process.exit(exitCode), 10_000);
  timer.unref();
  void worker.close().finally(() => {
    server.close(() => {
      closeStats();
      clearTimeout(timer);
      process.exit(exitCode);
    });
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

// On SIGTERM, finish the job in progress before exiting (scale-down safe).
process.on("SIGTERM", async () => {
  await worker.close();
  server.close();
  closeStats();
  process.exit(0);
});
