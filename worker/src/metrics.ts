import { Registry, Counter, Histogram, collectDefaultMetrics } from "prom-client";

export const registry = new Registry();
collectDefaultMetrics({ register: registry }); // process CPU, memory, event loop lag

export const jobsProcessed = new Counter({
  name: "jobs_processed_total",
  help: "Jobs completed successfully",
  labelNames: ["type"],
  registers: [registry],
});

export const jobErrors = new Counter({
  name: "job_errors_total",
  help: "Jobs that threw an error",
  labelNames: ["type"],
  registers: [registry],
});

export const jobDuration = new Histogram({
  name: "job_processing_time_seconds",
  help: "Time spent processing a job",
  labelNames: ["type"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});
