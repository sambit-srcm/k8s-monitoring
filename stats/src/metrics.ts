import { Registry, Gauge, collectDefaultMetrics } from "prom-client";

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

// Gauges mirror Redis counters; prom-client counters cannot be set to an absolute value.
export const totalJobsSubmitted = new Gauge({
  name: "total_jobs_submitted",
  help: "Jobs submitted, read from Redis",
  registers: [registry],
});

export const totalJobsCompleted = new Gauge({
  name: "total_jobs_completed",
  help: "Jobs completed, read from Redis",
  registers: [registry],
});

export const totalJobsFailed = new Gauge({
  name: "total_jobs_failed",
  help: "Jobs failed, read from Redis",
  registers: [registry],
});

export const queueLength = new Gauge({
  name: "queue_length",
  help: "Jobs waiting in the BullMQ queue",
  registers: [registry],
});

export const activeJobs = new Gauge({
  name: "active_jobs",
  help: "Jobs currently active",
  registers: [registry],
});

export const avgJobProcessingSeconds = new Gauge({
  name: "avg_job_processing_seconds",
  help: "Average processing time in seconds",
  registers: [registry],
});
