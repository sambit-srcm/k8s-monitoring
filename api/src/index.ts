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

process.on("SIGTERM", async () => {
  server.close();
  await queue.close();
  redis.disconnect();
  process.exit(0);
});
