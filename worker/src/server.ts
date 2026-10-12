import http from "node:http";
import { createLogger } from "@app/shared";
import { registry } from "./metrics";

const log = createLogger("worker");

export function startMetricsServer(port: number): http.Server {
  const server = http.createServer(async (req, res) => {
    if (req.url === "/metrics") {
      res.setHeader("Content-Type", registry.contentType);
      res.end(await registry.metrics());
    } else if (req.url === "/health") {
      res.end("ok");
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  server.listen(port, () => log.info(`worker metrics on :${port}`));
  return server;
}
