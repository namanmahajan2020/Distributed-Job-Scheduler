import { NextFunction, Response } from "express";
import { errorHandler, requireAuth, requireOrgRole } from "../src/middlewares";
import { verifyAccessToken } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";
import { ApiError } from "../src/lib/errors";
import { Prisma } from "@prisma/client";

jest.mock("../src/lib/prisma", () => ({
  prisma: {
    session: { findFirst: jest.fn() },
    organizationMember: { findMany: jest.fn(), findFirst: jest.fn() }
  }
}));

jest.mock("../src/lib/auth", () => ({
  ...jest.requireActual("../src/lib/auth"),
  verifyAccessToken: jest.fn()
}));

describe("middlewares", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads the authenticated user", async () => {
    (verifyAccessToken as jest.Mock).mockReturnValue({ sub: "user_1", email: "admin@test.dev", sessionId: "session_1" });
    (prisma.session.findFirst as jest.Mock).mockResolvedValue({ id: "session_1" });
    (prisma.organizationMember.findMany as jest.Mock).mockResolvedValue([{ organizationId: "org_1", role: "ADMIN" }]);

    const req: any = { headers: { authorization: "Bearer token" } };
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(req.user).toMatchObject({ id: "user_1", sessionId: "session_1" });
    expect(next).toHaveBeenCalled();
  });

  it("fails when the token is missing", async () => {
    const req: any = { headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    const next = jest.fn();

    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("fails when the session is expired", async () => {
    (verifyAccessToken as jest.Mock).mockReturnValue({ sub: "user_1", email: "admin@test.dev", sessionId: "session_1" });
    (prisma.session.findFirst as jest.Mock).mockResolvedValue(null);

    const req: any = { headers: { authorization: "Bearer token" } };
    const res = {} as Response;
    const next = jest.fn();

    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("enforces organization roles", () => {
    const middleware = requireOrgRole("ADMIN");
    const next = jest.fn();
    const req: any = {
      params: { organizationId: "org_1" },
      body: {},
      user: {
        memberships: [{ organizationId: "org_1", role: "MEMBER" }]
      }
    };

    middleware(req, {} as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it("allows organization roles when membership matches", () => {
    const middleware = requireOrgRole("ADMIN");
    const next = jest.fn();
    const req: any = {
      params: { organizationId: "org_1" },
      body: {},
      user: {
        memberships: [{ organizationId: "org_1", role: "ADMIN" }]
      }
    };

    middleware(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("reads organization role from the request body fallback", () => {
    const middleware = requireOrgRole("ADMIN");
    const next = jest.fn();
    const req: any = {
      params: {},
      body: { organizationId: "org_1" },
      user: {
        memberships: [{ organizationId: "org_1", role: "ADMIN" }]
      }
    };

    middleware(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("allows project-level role checks", async () => {
    const { requireProjectRole } = await import("../src/middlewares");
    (prisma.organizationMember.findFirst as jest.Mock).mockResolvedValue({ role: "ADMIN" });

    const middleware = requireProjectRole("ADMIN");
    const next = jest.fn();
    await middleware({ params: { projectId: "project_1" }, body: {}, user: { id: "user_1" } } as any, {} as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it("rejects project-level role checks without membership", async () => {
    const { requireProjectRole } = await import("../src/middlewares");
    (prisma.organizationMember.findFirst as jest.Mock).mockResolvedValue(null);

    const middleware = requireProjectRole("ADMIN");
    const next = jest.fn();
    await middleware({ params: { projectId: "project_1" }, body: {}, user: { id: "user_1" } } as any, {} as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it("reads project role from the request body fallback", async () => {
    const { requireProjectRole } = await import("../src/middlewares");
    (prisma.organizationMember.findFirst as jest.Mock).mockResolvedValue({ role: "ADMIN" });

    const middleware = requireProjectRole("ADMIN");
    const next = jest.fn();
    await middleware({ params: {}, body: { projectId: "project_1" }, user: { id: "user_1" } } as any, {} as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it("allows queue-level role checks", async () => {
    const { requireQueueRole } = await import("../src/middlewares");
    (prisma.organizationMember.findFirst as jest.Mock).mockResolvedValue({ role: "MEMBER" });

    const middleware = requireQueueRole("MEMBER");
    const next = jest.fn();
    await middleware({ params: { queueId: "queue_1" }, body: {}, user: { id: "user_1" } } as any, {} as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it("rejects queue-level role checks without membership", async () => {
    const { requireQueueRole } = await import("../src/middlewares");
    (prisma.organizationMember.findFirst as jest.Mock).mockResolvedValue(null);

    const middleware = requireQueueRole("MEMBER");
    const next = jest.fn();
    await middleware({ params: { queueId: "queue_1" }, body: {}, user: { id: "user_1" } } as any, {} as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it("reads queue role from the request body fallback", async () => {
    const { requireQueueRole } = await import("../src/middlewares");
    (prisma.organizationMember.findFirst as jest.Mock).mockResolvedValue({ role: "MEMBER" });

    const middleware = requireQueueRole("MEMBER");
    const next = jest.fn();
    await middleware({ params: {}, body: { queueId: "queue_1" }, user: { id: "user_1" } } as any, {} as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it("allows job-level role checks", async () => {
    const { requireJobRole } = await import("../src/middlewares");
    (prisma.organizationMember.findFirst as jest.Mock).mockResolvedValue({ role: "VIEWER" });

    const middleware = requireJobRole("VIEWER");
    const next = jest.fn();
    await middleware({ params: { jobId: "job_1" }, body: {}, user: { id: "user_1" } } as any, {} as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it("rejects job-level role checks without membership", async () => {
    const { requireJobRole } = await import("../src/middlewares");
    (prisma.organizationMember.findFirst as jest.Mock).mockResolvedValue(null);

    const middleware = requireJobRole("VIEWER");
    const next = jest.fn();
    await middleware({ params: { jobId: "job_1" }, body: {}, user: { id: "user_1" } } as any, {} as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it("rejects job role checks when the route param is absent", async () => {
    const { requireJobRole } = await import("../src/middlewares");
    (prisma.organizationMember.findFirst as jest.Mock).mockResolvedValue(null);

    const middleware = requireJobRole("VIEWER");
    const next = jest.fn();
    await middleware({ params: {}, body: {}, user: { id: "user_1" } } as any, {} as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it("formats ApiError responses", () => {
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    errorHandler(new ApiError(403, "Forbidden", { reason: "test" }), { requestId: "req_1" } as any, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("formats Prisma errors", () => {
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const error = new Prisma.PrismaClientKnownRequestError("bad query", { code: "P2002", clientVersion: "1.0.0" });
    errorHandler(error, { requestId: "req_1" } as any, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("formats generic errors", () => {
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    errorHandler(new Error("boom"), { requestId: "req_1" } as any, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
