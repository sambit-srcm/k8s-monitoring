import { describe, expect, it } from "vitest";
import { hashPassword, holdMemory, primesUpTo, run, sortRandomInts } from "./jobs";

describe("jobs", () => {
  it("counts primes", () => {
    expect(primesUpTo(10)).toBe(4);
  });

  it("sorts a small list", () => {
    const sorted = sortRandomInts(5);
    expect(sorted.min).toBeLessThanOrEqual(sorted.max);
  });

  it("hashes a password and holds a small buffer", async () => {
    expect(await hashPassword("x")).toMatch(/^\$2/);
    expect(await holdMemory(1, 0)).toBe(1024 * 1024);
  });

  it("runs sort and memory jobs", async () => {
    const sorted = await run({ type: "sort", megabytes: 1 }, "2");
    expect(sorted.summary).toContain("sorted 100000");
    const held = await run({ type: "memory", megabytes: 1 }, "3");
    expect(held.summary).toContain("held");
  });

  it("runs a primes job", async () => {
    const result = await run({ type: "primes", megabytes: 1 }, "1");
    expect(result.type).toBe("primes");
    expect(result.summary).toContain("primes");
  });
});
