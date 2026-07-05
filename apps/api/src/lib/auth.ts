import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config";

export type AccessTokenPayload = {
  sub: string;
  email: string;
  sessionId: string;
  type: "access";
};

export type RefreshTokenPayload = {
  sub: string;
  email: string;
  sessionId: string;
  tokenId: string;
  type: "refresh";
};

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const comparePassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export const signAccessToken = (payload: Omit<AccessTokenPayload, "type">) =>
  jwt.sign({ ...payload, type: "access" }, env.JWT_ACCESS_SECRET, { expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m` });

export const signRefreshToken = (payload: Omit<RefreshTokenPayload, "type">) =>
  jwt.sign({ ...payload, type: "refresh" }, env.JWT_REFRESH_SECRET, { expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d` });

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;

export const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");
