import express, { type Request, type Response } from "express";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import {
  QUEUE_NAME,
  STATS_KEYS,
  redisConnection,
  JobPayloadSchema,
  type JobData,
  type JobResult,
  type JobType,
} from "@app/shared";

const PORT = Number(process.env.PORT ?? 3000);

const queue = new Queue<JobData, JobResult>(QUEUE_NAME, {
  connection: redisConnection(),
});
queue.on("error", (err) => console.error("queue error", err.message));

const redis = new Redis(redisConnection());
redis.on("error", (err) => console.error("redis error", err.message));

function pickJobType(): JobType {
  const r = Math.random();
  if (r < 0.7 / 3) return "primes";
  if (r < (0.7 / 3) * 2) return "bcrypt";
  if (r < 0.7) return "sort";
  return "memory";
}

const app = express();
app.use(express.json());

const submitHandler = async (req: Request, res: Response) => {
  const parsed = JobPayloadSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  const data: JobData = {
    type: parsed.data.type ?? pickJobType(),
    megabytes: parsed.data.megabytes,
  };

  // Keep recent jobs so GET /status/:id still works, then drop them so Redis stays bounded.
  const job = await queue.add(data.type, data, {
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 86400, count: 1000 },
  });
  await redis.incr(STATS_KEYS.submitted);
  res.status(202).json({ id: job.id, type: data.type });
};
app.post("/submit", submitHandler);
app.get("/submit", submitHandler);

app.get("/status/:id", async (req, res) => {
  const job = await queue.getJob(req.params.id);
  if (!job) return res.sendStatus(404);
  res.json({
    id: job.id,
    type: job.data.type,
    state: await job.getState(),
    result: job.returnvalue,
  });
});

app.get("/health", (_req, res) => res.send("ok"));

const server = app.listen(PORT, () => console.log(`api on :${PORT}`));

process.on("SIGTERM", async () => {
  server.close();
  await queue.close();
  redis.disconnect();
  process.exit(0);
});
