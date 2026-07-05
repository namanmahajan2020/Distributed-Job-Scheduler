import { hashPassword, comparePassword, hashToken } from "../src/lib/auth";

describe("auth library", () => {
  it("hashes and compares passwords", async () => {
    const hashed = await hashPassword("Password123!");
    await expect(comparePassword("Password123!", hashed)).resolves.toBe(true);
  });

  it("hashes opaque tokens", () => {
    expect(hashToken("token-value")).toHaveLength(64);
  });
});
