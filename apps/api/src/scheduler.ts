import cron from "node-cron";
import { env } from "./config";
import { jobService, metricsService, recurringJobService, workerService, queueService } from "./services";
import { realtime } from "./realtime";

export const registerScheduler = () => {
  const tasks = [
    cron.schedule("*/1 * * * *", async () => {
      await jobService.promoteScheduledJobs();
    }),
    cron.schedule("*/1 * * * *", async () => {
      await jobService.recoverStaleJobs();
      await workerService.markStaleWorkers();
    }),
    cron.schedule(env.RECURRING_SCAN_CRON, async () => {
      await recurringJobService.triggerDueRecurringJobs();
    })
  ];

  const snapshotInterval = setInterval(async () => {
    const [metrics, queues, workers, jobs] = await Promise.all([
      metricsService.getDashboardMetrics(),
      queueService.listQueues({ page: 1, limit: 5, sortOrder: "desc" }),
      workerService.listWorkers({ page: 1, limit: 10, sortOrder: "desc" }),
      jobService.listJobs({ page: 1, limit: 10, sortOrder: "desc" })
    ]);
    realtime.emitSnapshot({ metrics, queues, workers, jobs });
    realtime.emitMetricsUpdate(metrics);
  }, env.SOCKET_SNAPSHOT_INTERVAL_MS);

  return () => {
    tasks.forEach((task) => task.stop());
    clearInterval(snapshotInterval);
  };
};
