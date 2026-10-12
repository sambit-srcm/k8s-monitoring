import pino, { type Logger } from "pino";

export function createLogger(name: string): Logger {
  return pino({
    level: process.env.LOG_LEVEL ?? "info",
    name,
  });
}
