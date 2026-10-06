import type { Job } from "bullmq";
import { Redis } from "ioredis";
import { STATS_KEYS, redisConnection, type JobData, type JobResult } from "@app/shared";
import { run } from "./jobs";
import { jobsProcessed, jobErrors, jobDuration } from "./metrics";

const stats = new Redis(redisConnection());
stats.on("error", (err) => console.error("redis error", err.message));

export async function processJob(job: Job<JobData, JobResult>): Promise<JobResult> {
  const { type } = job.data;
  const start = process.hrtime.bigint();
  try {
    const result = await run(job.data, String(job.id));
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;

    jobDuration.observe({ type }, seconds);
    jobsProcessed.inc({ type });
    await stats.incr(STATS_KEYS.completed);
    await stats.incrbyfloat(STATS_KEYS.timeSum, seconds);
    return result;
  } catch (err) {
    jobErrors.inc({ type });
    await stats.incr(STATS_KEYS.failed);
    throw err;
  }
}

export function closeStats(): void {
  stats.disconnect();
}
