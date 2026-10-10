import { afterEach, describe, expect, it, vi } from "vitest";
import { pickJobType } from "./jobType";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pickJobType", () => {
  it("can return every job type", () => {
    const values = [0, 0.3, 0.5, 0.9];
    let index = 0;
    vi.spyOn(Math, "random").mockImplementation(() => values[index++] ?? 0);
    expect([pickJobType(), pickJobType(), pickJobType(), pickJobType()]).toEqual([
      "primes",
      "bcrypt",
      "sort",
      "memory",
    ]);
  });
});
