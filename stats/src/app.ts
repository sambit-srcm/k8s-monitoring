import { STATS_KEYS, createLogger } from "@app/shared";
import express from "express";
import {
  activeJobs,
  avgJobProcessingSeconds,
  queueLength,
  registry,
  totalJobsCompleted,
  totalJobsFailed,
  totalJobsSubmitted,
} from "./metrics";

const log = createLogger("stats");

export type StatsRedis = {
  mget: (...keys: string[]) => Promise<Array<string | null>>;
  ping: () => Promise<unknown>;
};

export type StatsQueue = {
  getJobCounts: (...types: Array<"waiting" | "active">) => Promise<{
    waiting?: number;
    active?: number;
  }>;
};

type Snapshot = {
  submitted: number;
  completed: number;
  failed: number;
  queueLength: number;
  active: number;
  avgProcessingSeconds: number;
};

async function pingWithin(ping: () => Promise<unknown>, timeoutMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      ping(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function toNumber(value: string | null): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function readSnapshot(redis: StatsRedis, queue: StatsQueue): Promise<Snapshot> {
  const [values, counts] = await Promise.all([
    redis.mget(STATS_KEYS.submitted, STATS_KEYS.completed, STATS_KEYS.failed, STATS_KEYS.timeSum),
    queue.getJobCounts("waiting", "active"),
  ]);
  const submitted = toNumber(values[0] ?? null);
  const completed = toNumber(values[1] ?? null);
  const failed = toNumber(values[2] ?? null);
  const timeSum = toNumber(values[3] ?? null);
  return {
    submitted,
    completed,
    failed,
    queueLength: counts.waiting ?? 0,
    active: counts.active ?? 0,
    avgProcessingSeconds: completed === 0 ? 0 : timeSum / completed,
  };
}

export function createStatsApp(deps: { redis: StatsRedis; queue: StatsQueue }): express.Express {
  const { redis, queue } = deps;
  const app = express();

  app.get("/health", (_req, res) => {
    res.send("ok");
  });

  app.get("/ready", async (_req, res) => {
    if (await pingWithin(redis.ping.bind(redis), 2000)) {
      res.status(200).json({ status: "ready" });
      return;
    }
    res.status(503).json({ status: "not_ready" });
  });

  app.get("/stats", async (_req, res) => {
    try {
      res.json(await readSnapshot(redis, queue));
    } catch (err) {
      const message = err instanceof Error ? err.message : "redis unavailable";
      log.error({ err: message }, "stats read failed");
      res.status(503).json({ error: "redis_unavailable" });
    }
  });

  app.get("/metrics", async (_req, res) => {
    try {
      const snapshot = await readSnapshot(redis, queue);
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
      log.error({ err: message }, "metrics read failed");
      res.status(503).end();
    }
  });

  return app;
}
