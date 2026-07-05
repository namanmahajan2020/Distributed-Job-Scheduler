import { authService } from "../src/services";
import { prisma } from "../src/lib/prisma";
import * as authLib from "../src/lib/auth";

jest.mock("../src/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn(), findUniqueOrThrow: jest.fn() },
    session: { create: jest.fn(), update: jest.fn() },
    refreshToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(async (actions: any) => Promise.all(actions))
  }
}));

describe("authService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers a new user", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: "user_1",
      email: "new@test.dev",
      name: "New User",
      passwordHash: "hashed"
    });

    const user = await authService.register({ email: "new@test.dev", password: "Password123!", name: "New User" });

    expect(user).toEqual({
      id: "user_1",
      email: "new@test.dev",
      name: "New User"
    });
  });

  it("logs in and returns session tokens", async () => {
    const passwordHash = await authLib.hashPassword("Password123!");
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user_1",
      email: "admin@test.dev",
      name: "Admin",
      passwordHash,
      memberships: []
    });
    (prisma.session.create as jest.Mock).mockResolvedValue({ id: "session_1" });
    (prisma.refreshToken.create as jest.Mock).mockResolvedValue({ id: "token_1" });

    const result = await authService.login({ email: "admin@test.dev", password: "Password123!" });

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user.email).toBe("admin@test.dev");
  });

  it("rotates a refresh token", async () => {
    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      id: "token_1",
      userId: "user_1",
      sessionId: "session_1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      session: { revokedAt: null },
      user: { id: "user_1", email: "admin@test.dev" }
    });
    (prisma.refreshToken.update as jest.Mock).mockResolvedValue({});
    (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

    const original = authLib.signRefreshToken({
      sub: "user_1",
      email: "admin@test.dev",
      sessionId: "session_1",
      tokenId: "token_1"
    });

    const result = await authService.refresh(original);

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(prisma.refreshToken.update).toHaveBeenCalled();
  });
});
