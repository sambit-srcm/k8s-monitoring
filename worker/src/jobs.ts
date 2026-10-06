import bcrypt from "bcrypt";
import type { JobData, JobResult } from "@app/shared";

export function primesUpTo(n: number): number {
  const sieve = new Uint8Array(n + 1);
  let count = 0;
  for (let i = 2; i <= n; i++) {
    if (sieve[i] === 0) {
      count++;
      for (let j = i * i; j <= n; j += i) sieve[j] = 1;
    }
  }
  return count;
}

export function sortRandomInts(size: number): { min: number; max: number } {
  const arr = Array.from({ length: size }, () => Math.floor(Math.random() * 1e9));
  arr.sort((a, b) => a - b);
  return { min: arr[0], max: arr[arr.length - 1] };
}

export function hashPassword(input: string): Promise<string> {
  return bcrypt.hash(input, 10);
}

export async function holdMemory(mb: number, holdMs = 1000): Promise<number> {
  const buf = Buffer.alloc(mb * 1024 * 1024, 1); // fill so pages are really touched
  await new Promise((r) => setTimeout(r, holdMs));
  return buf.length;
}

export async function run(data: JobData, jobId: string): Promise<JobResult> {
  switch (data.type) {
    case "primes":
      return { type: "primes", summary: `${primesUpTo(100_000)} primes <= 100000` };
    case "bcrypt":
      return { type: "bcrypt", summary: await hashPassword(`password-${jobId}`) };
    case "sort": {
      const { min, max } = sortRandomInts(100_000);
      return { type: "sort", summary: `sorted 100000 ints, min=${min} max=${max}` };
    }
    case "memory": {
      const bytes = await holdMemory(data.megabytes);
      return { type: "memory", summary: `held ${bytes} bytes for 1s` };
    }
  }
}
