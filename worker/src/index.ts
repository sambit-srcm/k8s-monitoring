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

// On SIGTERM, finish the job in progress before exiting (scale-down safe).
process.on("SIGTERM", async () => {
  await worker.close();
  server.close();
  closeStats();
  process.exit(0);
});
