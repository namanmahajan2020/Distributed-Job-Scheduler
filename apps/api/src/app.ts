import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { router } from "./routes";
import { attachRequestContext, errorHandler, requestLogger } from "./middlewares";
import { env } from "./config";
import { openApiDocument } from "./openapi";

export const createApp = () => {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN }));
  app.use(express.json({ limit: "2mb" }));
  app.use(attachRequestContext);
  app.use(requestLogger);
  app.use(rateLimit({ windowMs: 60_000, max: 300 }));
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get("/api/openapi.json", (_req, res) => res.json(openApiDocument));
  app.use("/api", router);
  app.use(errorHandler);
  return app;
};
