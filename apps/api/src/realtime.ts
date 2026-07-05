import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { env } from "./config";

type SnapshotPayload = {
  queues?: unknown;
  workers?: unknown;
  jobs?: unknown;
  metrics?: unknown;
};

let io: Server | null = null;

export const registerRealtime = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: env.WEB_ORIGIN
    }
  });

  io.on("connection", (socket) => {
    socket.emit("system:connected", { connectedAt: new Date().toISOString() });
  });

  return io;
};

export const realtime = {
  emitQueueUpdate: (payload: unknown) => io?.emit("queue:update", payload),
  emitWorkerUpdate: (payload: unknown) => io?.emit("worker:update", payload),
  emitJobUpdate: (payload: unknown) => io?.emit("job:update", payload),
  emitLogUpdate: (payload: unknown) => io?.emit("log:create", payload),
  emitMetricsUpdate: (payload: unknown) => io?.emit("metrics:update", payload),
  emitSnapshot: (payload: SnapshotPayload) => io?.emit("snapshot:update", payload)
};
