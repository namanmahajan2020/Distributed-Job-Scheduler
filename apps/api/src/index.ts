import http from "http";
import { createApp } from "./app";
import { env } from "./config";
import { logger } from "./lib/logger";
import { registerRealtime } from "./realtime";
import { registerScheduler } from "./scheduler";

const app = createApp();
const server = http.createServer(app);
registerRealtime(server);
const shutdownScheduler = registerScheduler();

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "API listening");
});

process.on("SIGTERM", () => {
  shutdownScheduler();
  server.close();
});
