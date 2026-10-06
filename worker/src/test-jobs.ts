import { primesUpTo, sortRandomInts, hashPassword, holdMemory } from "./jobs";

(async () => {
  console.time("primes");
  console.log(primesUpTo(100_000));
  console.timeEnd("primes");
  console.time("sort");
  console.log(sortRandomInts(100_000));
  console.timeEnd("sort");
  console.time("bcrypt");
  console.log(await hashPassword("test"));
  console.timeEnd("bcrypt");
  console.time("memory");
  console.log(await holdMemory(100));
  console.timeEnd("memory");
})();
