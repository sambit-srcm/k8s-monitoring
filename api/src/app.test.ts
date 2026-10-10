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

  it("returns 404 when the job is missing", async () => {
    const { app } = deps(undefined);
    const response = await request(app).get("/status/missing");
    expect(response.status).toBe(404);
  });

  it("returns 200 from /health", async () => {
    const { app } = deps();
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.text).toBe("ok");
  });
});
