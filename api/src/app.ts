import express, { type NextFunction, type Request, type Response } from "express";
import { STATS_KEYS, JobPayloadSchema, createLogger, type JobData } from "@app/shared";
import { pickJobType } from "./jobType";

const log = createLogger("api");
const JOB_ID = /^[A-Za-z0-9:_-]{1,64}$/;

export type SubmitJob = {
  id?: string;
  data: JobData;
  returnvalue: unknown;
  getState: () => Promise<string>;
};

export type SubmitQueue = {
  add: (
    name: string,
    data: JobData,
    opts: {
      removeOnComplete: { age: number; count: number };
      removeOnFail: { age: number; count: number };
    },
  ) => Promise<{ id?: string }>;
  getJob: (id: string) => Promise<SubmitJob | undefined>;
};

export type SubmitCounter = {
  incr: (key: string) => Promise<unknown>;
};

export function createApp(deps: { queue: SubmitQueue; redis: SubmitCounter }): express.Express {
  const { queue, redis } = deps;
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
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (id === undefined || !JOB_ID.test(id)) {
      return res.status(400).json({ error: "invalid_id" });
    }
    const job = await queue.getJob(id);
    if (!job) return res.sendStatus(404);
    res.json({
      id: job.id,
      type: job.data.type,
      state: await job.getState(),
      result: job.returnvalue,
    });
  });

  app.get("/health", (_req, res) => res.send("ok"));

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const status = clientStatus(err);
    if (status !== undefined) {
      res.status(status).json({ error: "bad_request" });
      return;
    }
    log.error({ err }, "request failed");
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}

function clientStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null || !("status" in err)) return undefined;
  const status = err.status;
  if (typeof status !== "number" || status < 400 || status >= 500) return undefined;
  return status;
}
