import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";
import { STATS_KEYS, type JobData, type JobResult } from "@app/shared";

const redisMocks = vi.hoisted(() => ({
  incr: vi.fn(),
  incrbyfloat: vi.fn(),
  on: vi.fn(),
  disconnect: vi.fn(),
}));

const metricMocks = vi.hoisted(() => ({
  processed: vi.fn(),
  errors: vi.fn(),
  observe: vi.fn(),
}));

const run = vi.hoisted(() => vi.fn());

vi.mock("ioredis", () => ({
  Redis: class {
    incr = redisMocks.incr;
    incrbyfloat = redisMocks.incrbyfloat;
    on = redisMocks.on;
    disconnect = redisMocks.disconnect;
  },
}));

vi.mock("./metrics", () => ({
  jobsProcessed: { inc: metricMocks.processed },
  jobErrors: { inc: metricMocks.errors },
  jobDuration: { observe: metricMocks.observe },
}));

vi.mock("./jobs", () => ({
  run,
}));

import { closeStats, processJob } from "./processor";

function job(): Job<JobData, JobResult> {
  return {
    id: "1",
    data: { type: "primes", megabytes: 100 },
  } as Job<JobData, JobResult>;
}

describe("processJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a completed job and its duration", async () => {
    run.mockResolvedValue({ type: "primes", summary: "ok" });
    await expect(processJob(job())).resolves.toEqual({ type: "primes", summary: "ok" });
    expect(metricMocks.processed).toHaveBeenCalledWith({ type: "primes" });
    expect(metricMocks.observe).toHaveBeenCalledWith({ type: "primes" }, expect.any(Number));
    expect(redisMocks.incr).toHaveBeenCalledWith(STATS_KEYS.completed);
    expect(redisMocks.incrbyfloat).toHaveBeenCalledWith(STATS_KEYS.timeSum, expect.any(Number));
  });

  it("disconnects the stats client", () => {
    closeStats();
    expect(redisMocks.disconnect).toHaveBeenCalledOnce();
  });

  it("records a failure and rethrows", async () => {
    run.mockRejectedValue(new Error("boom"));
    await expect(processJob(job())).rejects.toThrow("boom");
    expect(metricMocks.errors).toHaveBeenCalledWith({ type: "primes" });
    expect(redisMocks.incr).toHaveBeenCalledWith(STATS_KEYS.failed);
  });
});
