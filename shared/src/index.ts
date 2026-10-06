import { z } from "zod";

export const QUEUE_NAME = "jobs";

export const redisConnection = () => ({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
});

// Redis counters that Service C (stats) will read
export const STATS_KEYS = {
  submitted: "stats:submitted",
  completed: "stats:completed",
  failed: "stats:failed",
  timeSum: "stats:time_sum",
} as const;

export const JOB_TYPES = ["primes", "bcrypt", "sort", "memory"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JobPayloadSchema = z.object({
  type: z.enum(JOB_TYPES).optional(),
  megabytes: z.number().int().positive().max(200).default(100),
});

export type JobData = {
  type: JobType;
  megabytes: number;
};

export type JobResult = {
  type: JobType;
  summary: string;
};
