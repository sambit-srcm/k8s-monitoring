import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createStatsApp, toNumber, type StatsQueue, type StatsRedis } from "./app";

describe("toNumber", () => {
  it("reads numbers and treats empty or junk values as zero", () => {
    expect(toNumber("12")).toBe(12);
    expect(toNumber(null)).toBe(0);
    expect(toNumber("nope")).toBe(0);
  });
});

describe("stats routes", () => {
  it("returns 503 redis_unavailable when redis fails", async () => {
    const redis: StatsRedis = {
      mget: vi.fn(async () => {
        throw new Error("down");
      }),
    };
    const queue: StatsQueue = {
      getJobCounts: vi.fn(async () => ({ waiting: 0, active: 0 })),
    };
    const response = await request(createStatsApp({ redis, queue })).get("/stats");
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "redis_unavailable" });
  });

  it("serves metrics from the snapshot", async () => {
    const redis: StatsRedis = {
      mget: vi.fn(async () => ["1", "1", "0", "2"]),
    };
    const queue: StatsQueue = {
      getJobCounts: vi.fn(async () => ({ waiting: 0, active: 0 })),
    };
    const response = await request(createStatsApp({ redis, queue })).get("/metrics");
    expect(response.status).toBe(200);
    expect(response.text).toContain("total_jobs_submitted");
  });

  it("returns 503 from /metrics when redis fails", async () => {
    const redis: StatsRedis = {
      mget: vi.fn(async () => {
        throw new Error("down");
      }),
    };
    const queue: StatsQueue = {
      getJobCounts: vi.fn(async () => ({ waiting: 0, active: 0 })),
    };
    const response = await request(createStatsApp({ redis, queue })).get("/metrics");
    expect(response.status).toBe(503);
    expect(response.text).toBe("");
  });

  it("maps stored counters through toNumber", async () => {
    const redis: StatsRedis = {
      mget: vi.fn(async () => ["4", "2", "nope", "6"]),
    };
    const queue: StatsQueue = {
      getJobCounts: vi.fn(async () => ({ waiting: 3, active: 1 })),
    };
    const response = await request(createStatsApp({ redis, queue })).get("/stats");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      submitted: 4,
      completed: 2,
      failed: 0,
      queueLength: 3,
      active: 1,
      avgProcessingSeconds: 3,
    });
  });
});
