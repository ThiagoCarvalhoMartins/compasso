import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import swaggerUi from "swagger-ui-express";
import { env } from "./env";
import { logger } from "./lib/logger";
import { requireAuth } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { openapi } from "./openapi";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { blocksRouter, categoriesRouter } from "./routes/blocks";
import { compassRouter } from "./routes/compass";
import { meRouter } from "./routes/me";
import { qpRouter } from "./routes/qp";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1); // App Service fica atrás de um proxy (HTTPS e IP real para o rate limit)
  app.disable("x-powered-by");

  app.use(helmet());
  // RNF05: CORS restrito aos dois front-ends
  app.use(cors({ origin: [env.WEB_ORIGIN, env.ADMIN_ORIGIN], credentials: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  if (env.NODE_ENV !== "test") app.use(pinoHttp({ logger }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  const v1 = express.Router();
  v1.get("/openapi.json", (_req, res) => {
    res.json(openapi);
  });
  v1.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));
  v1.use("/auth", authRouter);
  v1.use("/admin", adminRouter);
  v1.use("/me", requireAuth, meRouter);
  v1.use("/categories", requireAuth, categoriesRouter);
  v1.use("/blocks", requireAuth, blocksRouter);
  v1.use("/compass", requireAuth, compassRouter);
  v1.use("/qp-sessions", requireAuth, qpRouter);
  app.use("/api/v1", v1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
