import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: "../../.env" });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  LOG_LEVEL: z.string().default("info"),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().default(3000),
  WORKER_HEARTBEAT_INTERVAL_MS: z.coerce.number().default(5000),
  MAX_JOB_CLAIM_BATCH: z.coerce.number().default(10),
  RECURRING_SCAN_CRON: z.string().default("* * * * *"),
  SOCKET_SNAPSHOT_INTERVAL_MS: z.coerce.number().default(3000)
});

export const env = envSchema.parse(process.env);
