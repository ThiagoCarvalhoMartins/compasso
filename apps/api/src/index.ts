import { env } from "./env";

// RNF11: Application Insights antes de tudo, para instrumentar HTTP e Prisma.
if (env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  const { useAzureMonitor } = await import("applicationinsights");
  useAzureMonitor({ azureMonitorExporterOptions: { connectionString: env.APPLICATIONINSIGHTS_CONNECTION_STRING } });
}

const { createApp } = await import("./app");
const { logger } = await import("./lib/logger");

createApp().listen(env.PORT, () => {
  logger.info(`API do Compasso em http://localhost:${env.PORT}/api/v1 (docs em /api/v1/docs)`);
});
