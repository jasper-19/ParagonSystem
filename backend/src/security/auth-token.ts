import { randomUUID } from "node:crypto";
import { Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

const TOKEN_ISSUER = "paragon-api";
const TOKEN_AUDIENCE = "paragon-admin";
const TOKEN_LIFETIME = "8h";
const TOKEN_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export type AuthRole = "admin" | "staff";

export interface AuthTokenPayload extends JwtPayload {
  sub: string;
  role: AuthRole;
  sid?: string;
  staffId?: string;
}

export type AuthTokenSource = "bearer" | "cookie";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }

  if (
    process.env.NODE_ENV === "production" &&
    Buffer.byteLength(secret, "utf8") < 32
  ) {
    throw new Error("JWT_SECRET must be at least 32 bytes in production");
  }

  return secret;
}

function getCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? "__Host-paragon_session"
    : "paragon_session";
}

function getCookieSameSite(): "lax" | "strict" | "none" {
  const configured = process.env.AUTH_COOKIE_SAME_SITE?.toLowerCase();

  if (
    configured === "lax" ||
    configured === "strict" ||
    configured === "none"
  ) {
    return configured;
  }

  return process.env.NODE_ENV === "production" ? "none" : "lax";
}

function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const cookieName = part.slice(0, separatorIndex).trim();
    if (cookieName !== name) {
      continue;
    }

    const value = part.slice(separatorIndex + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function signAuthToken(input: {
  subject: string;
  role: AuthRole;
  sid?: string;
  staffId?: string;
}): string {
  return jwt.sign(
    {
      role: input.role,
      ...(input.sid ? { sid: input.sid } : {}),
      ...(input.staffId ? { staffId: input.staffId } : {}),
    },
    getJwtSecret(),
    {
      algorithm: "HS256",
      audience: TOKEN_AUDIENCE,
      expiresIn: TOKEN_LIFETIME,
      issuer: TOKEN_ISSUER,
      jwtid: randomUUID(),
      subject: input.subject,
    }
  );
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const payload = jwt.verify(token, getJwtSecret(), {
    algorithms: ["HS256"],
    audience: TOKEN_AUDIENCE,
    issuer: TOKEN_ISSUER,
  });

  if (
    typeof payload === "string" ||
    typeof payload.sub !== "string" ||
    (payload.role !== "admin" && payload.role !== "staff") ||
    (payload.sub !== "env-admin" && typeof payload.sid !== "string")
  ) {
    throw new Error("Invalid authentication token");
  }

  return payload as AuthTokenPayload;
}

export function getAuthToken(
  req: Pick<Request, "headers">
): { token: string; source: AuthTokenSource } | undefined {
  const authorization = req.headers.authorization;

  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7).trim();
    if (token) {
      return { token, source: "bearer" };
    }
  }

  const token = readCookie(req.headers.cookie, getCookieName());
  return token ? { token, source: "cookie" } : undefined;
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(getCookieName(), token, {
    httpOnly: true,
    maxAge: TOKEN_MAX_AGE_MS,
    path: "/",
    sameSite: getCookieSameSite(),
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(getCookieName(), {
    httpOnly: true,
    path: "/",
    sameSite: getCookieSameSite(),
    secure: process.env.NODE_ENV === "production",
  });
}
