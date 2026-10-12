import { afterEach, describe, expect, it } from "vitest";
import { JobPayloadSchema, redisConnection } from "./index";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("JobPayloadSchema", () => {
  it("defaults megabytes and allows an omitted type", () => {
    expect(JobPayloadSchema.parse({})).toEqual({ megabytes: 100 });
  });

  it("accepts a known job type", () => {
    expect(JobPayloadSchema.parse({ type: "primes", megabytes: 10 })).toEqual({
      type: "primes",
      megabytes: 10,
    });
  });

  it("rejects an unknown type", () => {
    expect(JobPayloadSchema.safeParse({ type: "nope" }).success).toBe(false);
  });

  it.each([0, -1, 201, 1.5])("rejects megabytes %s", (megabytes) => {
    expect(JobPayloadSchema.safeParse({ megabytes }).success).toBe(false);
  });
});

describe("redisConnection", () => {
  it("defaults host and port", () => {
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    expect(redisConnection()).toEqual({ host: "localhost", port: 6379 });
  });

  it("uses a valid host and port", () => {
    process.env.REDIS_HOST = "redis";
    process.env.REDIS_PORT = "6380";
    expect(redisConnection()).toEqual({ host: "redis", port: 6380 });
  });

  it.each(["nope", "0", "-1"])("falls back when REDIS_PORT is %s", (port) => {
    process.env.REDIS_PORT = port;
    expect(redisConnection().port).toBe(6379);
  });
});
