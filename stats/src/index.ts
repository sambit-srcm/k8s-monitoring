import { QUEUE_NAME, STATS_KEYS, redisConnection, type JobData, type JobResult } from "@app/shared";
import { Queue } from "bullmq";
import express from "express";
import { Redis } from "ioredis";
import {
  activeJobs,
  avgJobProcessingSeconds,
  queueLength,
  registry,
  totalJobsCompleted,
  totalJobsFailed,
  totalJobsSubmitted,
} from "./metrics";

const PORT = Number(process.env.PORT ?? 3100);

const connection = {
  ...redisConnection(),
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
};

const queue = new Queue<JobData, JobResult>(QUEUE_NAME, { connection });
queue.on("error", (err) => console.error("queue error", err.message));

const redis = new Redis(connection);
redis.on("error", (err) => console.error("redis error", err.message));

type Snapshot = {
  submitted: number;
  completed: number;
  failed: number;
  queueLength: number;
  active: number;
  avgProcessingSeconds: number;
};

async function readSnapshot(): Promise<Snapshot> {
  const [values, counts] = await Promise.all([
    redis.mget(STATS_KEYS.submitted, STATS_KEYS.completed, STATS_KEYS.failed, STATS_KEYS.timeSum),
    queue.getJobCounts("waiting", "active"),
  ]);
  const submitted = toNumber(values[0]);
  const completed = toNumber(values[1]);
  const failed = toNumber(values[2]);
  const timeSum = toNumber(values[3]);
  return {
    submitted,
    completed,
    failed,
    queueLength: counts.waiting ?? 0,
    active: counts.active ?? 0,
    avgProcessingSeconds: completed === 0 ? 0 : timeSum / completed,
  };
}

function toNumber(value: string | null): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

const app = express();

app.get("/health", (_req, res) => {
  res.send("ok");
});

app.get("/stats", async (_req, res) => {
  try {
    res.json(await readSnapshot());
  } catch (err) {
    const message = err instanceof Error ? err.message : "redis unavailable";
    console.error("stats read failed", message);
    res.status(503).json({ error: "redis_unavailable" });
  }
});

app.get("/metrics", async (_req, res) => {
  try {
    const snapshot = await readSnapshot();
    totalJobsSubmitted.set(snapshot.submitted);
    totalJobsCompleted.set(snapshot.completed);
    totalJobsFailed.set(snapshot.failed);
    queueLength.set(snapshot.queueLength);
    activeJobs.set(snapshot.active);
    avgJobProcessingSeconds.set(snapshot.avgProcessingSeconds);
    res.setHeader("Content-Type", registry.contentType);
    res.send(await registry.metrics());
  } catch (err) {
    const message = err instanceof Error ? err.message : "redis unavailable";
    console.error("metrics read failed", message);
    res.status(503).end();
  }
});

const server = app.listen(PORT, () => console.log(`stats on :${PORT}`));

process.on("SIGTERM", async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await queue.close().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : "queue close failed";
    console.error("queue close failed", message);
  });
  redis.disconnect();
  process.exit(0);
});
