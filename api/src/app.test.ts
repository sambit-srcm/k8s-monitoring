import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp, type SubmitJob, type SubmitQueue, type SubmitCounter } from "./app";

function deps(job?: SubmitJob) {
  const queue: SubmitQueue = {
    add: vi.fn(async () => ({ id: "job-1" })),
    getJob: vi.fn(async () => job),
  };
  const redis: SubmitCounter = {
    incr: vi.fn(async () => 1),
  };
  return { queue, redis, app: createApp({ queue, redis }) };
}

describe("api routes", () => {
  it("POST /submit returns 202 with id and type", async () => {
    const { app, queue, redis } = deps();
    const response = await request(app).post("/submit").send({ type: "primes", megabytes: 10 });
    expect(response.status).toBe(202);
    expect(response.body).toEqual({ id: "job-1", type: "primes" });
    expect(queue.add).toHaveBeenCalledOnce();
    expect(redis.incr).toHaveBeenCalledOnce();
  });

  it("GET /submit returns 202 with id and type", async () => {
    const { app } = deps();
    const response = await request(app).get("/submit");
    expect(response.status).toBe(202);
    expect(response.body.id).toBe("job-1");
    expect(["primes", "bcrypt", "sort", "memory"]).toContain(response.body.type);
  });

  it("returns 400 for an invalid payload", async () => {
    const { app } = deps();
    const response = await request(app).post("/submit").send({ type: "nope" });
    expect(response.status).toBe(400);
  });

  it("returns the job status", async () => {
    const job: SubmitJob = {
      id: "job-1",
      data: { type: "sort", megabytes: 100 },
      returnvalue: { type: "sort", summary: "done" },
      getState: async () => "completed",
    };
    const { app } = deps(job);
    const response = await request(app).get("/status/job-1");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: "job-1",
      type: "sort",
      state: "completed",
      result: { type: "sort", summary: "done" },
    });
  });

  it("rejects a job id with spaces, and one longer than 64 characters", async () => {
    const { app } = deps();
    expect((await request(app).get("/status/bad id")).status).toBe(400);
    expect((await request(app).get(`/status/${"a".repeat(65)}`)).status).toBe(400);
  });

  it("accepts a job id with the allowed characters", async () => {
    const job: SubmitJob = {
      id: "job:1_ok-2",
      data: { type: "sort", megabytes: 100 },
      returnvalue: null,
      getState: async () => "waiting",
    };
    const { app } = deps(job);
    const response = await request(app).get("/status/job:1_ok-2");
    expect(response.status).toBe(200);
    expect(response.body.id).toBe("job:1_ok-2");
  });

  it("returns 404 when the job is missing", async () => {
    const { app } = deps(undefined);
    const response = await request(app).get("/status/missing");
    expect(response.status).toBe(404);
  });

  it("hides internal errors", async () => {
    const queue: SubmitQueue = {
      add: vi.fn(async () => {
        throw new Error("secret-detail");
      }),
      getJob: vi.fn(async () => undefined),
    };
    const redis: SubmitCounter = { incr: vi.fn(async () => 1) };
    const response = await request(createApp({ queue, redis })).post("/submit").send({});
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "internal_error" });
    expect(JSON.stringify(response.body)).not.toContain("secret-detail");
  });

  it("returns 200 from /health", async () => {
    const { app } = deps();
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.text).toBe("ok");
  });
});
