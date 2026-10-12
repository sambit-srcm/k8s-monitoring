import { createLogger } from "@app/shared";
import { primesUpTo, sortRandomInts, hashPassword, holdMemory } from "./jobs";

const log = createLogger("test-jobs");

function timed(label: string, value: unknown, startedAt: number): void {
  log.info({ ms: Math.round(performance.now() - startedAt), result: value }, label);
}

void (async () => {
  const primesStarted = performance.now();
  timed("primes", primesUpTo(100_000), primesStarted);

  const sortStarted = performance.now();
  timed("sort", sortRandomInts(100_000), sortStarted);

  const bcryptStarted = performance.now();
  timed("bcrypt", await hashPassword("test"), bcryptStarted);

  const memoryStarted = performance.now();
  timed("memory", await holdMemory(100), memoryStarted);
})();
