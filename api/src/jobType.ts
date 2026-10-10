import type { JobType } from "@app/shared";

export function pickJobType(): JobType {
  const r = Math.random();
  if (r < 0.7 / 3) return "primes";
  if (r < (0.7 / 3) * 2) return "bcrypt";
  if (r < 0.7) return "sort";
  return "memory";
}
