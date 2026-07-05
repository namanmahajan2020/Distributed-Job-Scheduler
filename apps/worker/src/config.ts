import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: "../../.env" });

export const env = z.object({
  DATABASE_URL: z.string().min(1),
  WORKER_NAME: z.string().default(`worker-${process.pid}`),
  WORKER_CONCURRENCY: z.coerce.number().default(5),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().default(3000),
  WORKER_HEARTBEAT_INTERVAL_MS: z.coerce.number().default(5000),
  MAX_JOB_CLAIM_BATCH: z.coerce.number().default(10),
  WORKER_SHUTDOWN_TIMEOUT_MS: z.coerce.number().default(20000)
}).parse(process.env);
