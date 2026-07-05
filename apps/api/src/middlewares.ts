import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import crypto from "crypto";
import { prisma } from "./lib/prisma";
import { ApiError } from "./lib/errors";
import { verifyAccessToken } from "./lib/auth";
import { AuthedRequest } from "./types";
import { logger } from "./lib/logger";

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export const attachRequestContext = (req: AuthedRequest, res: Response, next: NextFunction) => {
  req.requestId = crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
};

export const requestLogger = (req: AuthedRequest, res: Response, next: NextFunction) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    logger.info({
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt
    }, "request completed");
  });
  next();
};

export const requireAuth = asyncHandler(async (req: AuthedRequest, _res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Authentication required");
  }

  const payload = verifyAccessToken(token);
  const session = await prisma.session.findFirst({
    where: {
      id: payload.sessionId,
      userId: payload.sub,
      revokedAt: null,
      expiresAt: { gt: new Date() }
    }
  });

  if (!session) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Session expired");
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: payload.sub },
    select: { organizationId: true, role: true }
  });

  req.user = {
    id: payload.sub,
    email: payload.email,
    sessionId: payload.sessionId,
    memberships
  };

  next();
});

export const requireOrgRole = (...roles: string[]) =>
  (req: AuthedRequest, _res: Response, next: NextFunction) => {
    const organizationId = String(req.params.organizationId || req.body.organizationId || "");
    const membership = req.user?.memberships.find((entry) => entry.organizationId === organizationId);
    if (!membership || !roles.includes(membership.role)) {
      return next(new ApiError(StatusCodes.FORBIDDEN, "Insufficient permissions"));
    }
    return next();
  };

const membershipForProject = async (projectId: string, userId: string) => prisma.organizationMember.findFirst({
  where: {
    userId,
    organization: {
      projects: {
        some: { id: projectId, deletedAt: null }
      }
    }
  }
});

const membershipForQueue = async (queueId: string, userId: string) => prisma.organizationMember.findFirst({
  where: {
    userId,
    organization: {
      projects: {
        some: {
          queues: {
            some: { id: queueId, deletedAt: null }
          }
        }
      }
    }
  }
});

const membershipForJob = async (jobId: string, userId: string) => prisma.organizationMember.findFirst({
  where: {
    userId,
    organization: {
      projects: {
        some: {
          queues: {
            some: {
              jobs: {
                some: { id: jobId }
              }
            }
          }
        }
      }
    }
  }
});

export const requireProjectRole = (...roles: string[]) => asyncHandler(async (req: AuthedRequest, _res: Response, next: NextFunction) => {
  const projectId = String(req.params.projectId || req.body.projectId || "");
  const membership = await membershipForProject(projectId, req.user!.id);
  if (!membership || !roles.includes(membership.role)) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Insufficient permissions");
  }
  next();
});

export const requireQueueRole = (...roles: string[]) => asyncHandler(async (req: AuthedRequest, _res: Response, next: NextFunction) => {
  const queueId = String(req.params.queueId || req.body.queueId || "");
  const membership = await membershipForQueue(queueId, req.user!.id);
  if (!membership || !roles.includes(membership.role)) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Insufficient permissions");
  }
  next();
});

export const requireJobRole = (...roles: string[]) => asyncHandler(async (req: AuthedRequest, _res: Response, next: NextFunction) => {
  const jobId = String(req.params.jobId || "");
  const membership = await membershipForJob(jobId, req.user!.id);
  if (!membership || !roles.includes(membership.role)) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Insufficient permissions");
  }
  next();
});

export const errorHandler = (error: unknown, req: AuthedRequest, res: Response, _next: NextFunction) => {
  logger.error({ error, requestId: req.requestId }, "request failed");

  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      error: {
        message: error.message,
        details: error.details ?? null,
        requestId: req.requestId
      }
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      error: {
        message: "Database constraint error",
        details: error.message,
        requestId: req.requestId
      }
    });
  }

  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: {
      message: "Internal server error",
      requestId: req.requestId
    }
  });
};
