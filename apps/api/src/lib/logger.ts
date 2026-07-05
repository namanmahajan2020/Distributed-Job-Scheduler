import pino from "pino";
import { env } from "../config";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: undefined,
  transport: env.NODE_ENV === "development" ? {
    target: "pino-pretty",
    options: { translateTime: "SYS:standard" }
  } : undefined
});
