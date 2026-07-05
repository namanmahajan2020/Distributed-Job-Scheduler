process.env.NODE_ENV = "test";
process.env.PORT = "4000";
process.env.WEB_ORIGIN = "http://localhost:5173";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/scheduler_test";
process.env.JWT_ACCESS_SECRET = "test-access-secret-123456";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-123456";
process.env.ACCESS_TOKEN_TTL_MINUTES = "15";
process.env.REFRESH_TOKEN_TTL_DAYS = "30";
process.env.LOG_LEVEL = "silent";

jest.mock("../src/realtime", () => ({
  realtime: {
    emitQueueUpdate: jest.fn(),
    emitWorkerUpdate: jest.fn(),
    emitJobUpdate: jest.fn(),
    emitLogUpdate: jest.fn(),
    emitMetricsUpdate: jest.fn(),
    emitSnapshot: jest.fn()
  },
  registerRealtime: jest.fn()
}));

jest.mock("../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));
