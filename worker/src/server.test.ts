import { describe, expect, it } from "vitest";
import { startMetricsServer } from "./server";

describe("metrics server", () => {
  it("serves health, metrics, and 404", async () => {
    const server = startMetricsServer(0);
    await new Promise<void>((resolve) => {
      server.once("listening", () => resolve());
    });
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("expected a tcp port");
    }
    const base = `http://127.0.0.1:${address.port}`;
    const health = await fetch(`${base}/health`);
    expect(await health.text()).toBe("ok");
    const metrics = await fetch(`${base}/metrics`);
    expect(metrics.status).toBe(200);
    expect(await metrics.text()).toContain("jobs_processed_total");
    const missing = await fetch(`${base}/nope`);
    expect(missing.status).toBe(404);
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });
});
