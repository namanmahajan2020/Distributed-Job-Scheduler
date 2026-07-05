import { OrganizationRole } from "@prisma/client";
import { Request } from "express";

export type AuthUser = {
  id: string;
  email: string;
  sessionId: string;
  memberships: Array<{ organizationId: string; role: OrganizationRole }>;
};

export type AuthedRequest = Request & { user?: AuthUser; requestId?: string };
