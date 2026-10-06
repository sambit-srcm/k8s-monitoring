import { Worker } from "bullmq";
import { QUEUE_NAME, redisConnection, type JobData, type JobResult } from "@app/shared";
import { processJob, closeStats } from "./processor";
import { startMetricsServer } from "./server";

const METRICS_PORT = Number(process.env.METRICS_PORT ?? 9100);

const worker = new Worker<JobData, JobResult>(QUEUE_NAME, processJob, {
  connection: redisConnection(),
  concurrency: 1,
});

worker.on("error", (err) => console.error("worker error", err.message));
worker.on("completed", (job) => console.log("done", job.id, job.data.type));
worker.on("failed", (job, err) => console.log("failed", job?.id, err.message));

const server = startMetricsServer(METRICS_PORT);

// On SIGTERM, finish the job in progress before exiting (scale-down safe).
process.on("SIGTERM", async () => {
  await worker.close();
  server.close();
  closeStats();
  process.exit(0);
});
