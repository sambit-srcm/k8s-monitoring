import { describe, expect, it } from "vitest";
import { primesUpTo, run, sortRandomInts } from "./jobs";

describe("jobs", () => {
  it("counts primes", () => {
    expect(primesUpTo(10)).toBe(4);
  });

  it("sorts a small list", () => {
    const sorted = sortRandomInts(5);
    expect(sorted.min).toBeLessThanOrEqual(sorted.max);
  });

  it("runs a primes job", async () => {
    const result = await run({ type: "primes", megabytes: 1 }, "1");
    expect(result.type).toBe("primes");
    expect(result.summary).toContain("primes");
  });
});
