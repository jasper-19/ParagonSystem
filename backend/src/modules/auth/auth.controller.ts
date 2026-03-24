import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../../utils/asyncHandler";
import * as userService from "../users/user.service";
import * as staffRepository from "../staff/staff.repository";
import * as sessionRepository from "./session.repository";
import { auditLog } from "../activity-logs/activity-log.audit";

/**
 * POST /api/auth/login
 * Body: { username: string, password: string }
 * Returns: { token: string }
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body as {
    username: string;
    password: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error("[login] Missing JWT_SECRET in .env");
    res.status(500).json({ error: "Internal server error" });
    return;
  }

  // Prefer DB-backed users. This is the "proper" auth path.
  const dbUser = await userService.authenticate(username, password);
  if (dbUser) {
    const userAgent = req.get("user-agent") || undefined;
    const ipAddress = (req as any).ip as string | undefined;

    const session = await sessionRepository.createSession({
      userId: dbUser.id,
      ...(userAgent ? { userAgent } : {}),
      ...(ipAddress ? { ipAddress } : {}),
    });
    const token = jwt.sign(
      { role: dbUser.role, staffId: dbUser.staffId, sid: session.id },
      jwtSecret,
      { subject: dbUser.id, expiresIn: "8h" }
    );
    auditLog(req, "LOGIN", "AUTH", `User login: ${dbUser.username}`, {
      resourceId: dbUser.id,
      userId: dbUser.id,
      details: { role: dbUser.role, sessionId: session.id },
    });
    res.json({ token });
    return;
  }

  // Back-compat: allow legacy env-based admin credentials if configured.
  // Useful for bootstrapping the first user without locking yourself out.
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  const adminStaffId = process.env.ADMIN_STAFF_ID;

  if (!adminUsername || !adminPasswordHash) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const usernameMatch = username === adminUsername;
  const passwordMatch = await bcrypt.compare(password, adminPasswordHash);

  if (!usernameMatch || !passwordMatch) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = jwt.sign(
    { role: "admin", staffId: adminStaffId },
    jwtSecret,
    { subject: "env-admin", expiresIn: "8h" }
  );
  auditLog(req, "LOGIN", "AUTH", `Env admin login: ${adminUsername}`, {
    details: { username: adminUsername, role: "admin" },
  });

  res.json({ token });
});

/**
 * PATCH /api/auth/password
 * Body: { currentPassword: string, newPassword: string }
 */
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "currentPassword and newPassword are required" });
    return;
  }

  const payload = (req as any).user as any;
  const subject = payload?.sub as string | undefined;
  const sessionId = payload?.sid as string | undefined;

  if (!subject) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  if (subject === "env-admin") {
    res.status(400).json({
      error:
        "Password change is not supported for env-admin. Update ADMIN_PASSWORD_HASH in your environment instead.",
    });
    return;
  }

  const user = await userService.getUserById(subject);
  if (!user) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordMatch) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  await userService.updateUser(subject, { password: newPassword });
  auditLog(req, "CHANGE_PASSWORD", "AUTH", `Changed password for user ${subject}`, {
    resourceId: subject,
    userId: subject,
  });

  // Revoke all other sessions as a safety measure after a password change.
  await sessionRepository.revokeAllOtherSessions(subject, sessionId);

  res.json({ ok: true });
});

/**
 * PATCH /api/auth/2fa
 * Body: { enabled: boolean }
 */
export const setTwoFaEnabled = asyncHandler(async (req: Request, res: Response) => {
  const enabled = (req.body as any)?.enabled;
  if (typeof enabled !== "boolean") {
    res.status(400).json({ error: "enabled must be a boolean" });
    return;
  }

  const payload = (req as any).user as any;
  const subject = payload?.sub as string | undefined;

  if (!subject) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  if (subject === "env-admin") {
    res.status(400).json({
      error: "2FA preference is not supported for env-admin. Create a DB-backed user instead.",
    });
    return;
  }

  const updated = await userService.updateUser(subject, { twoFaEnabled: enabled });
  if (!updated) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  auditLog(req, "SET_2FA", "AUTH", `Updated 2FA setting for user ${subject}`, {
    resourceId: subject,
    userId: subject,
    details: { enabled },
  });

  res.json({ twoFaEnabled: updated.twoFaEnabled ?? enabled });
});

/**
 * GET /api/auth/sessions
 */
export const listSessions = asyncHandler(async (req: Request, res: Response) => {
  const payload = (req as any).user as any;
  const subject = payload?.sub as string | undefined;
  const currentSessionId = payload?.sid as string | undefined;

  if (!subject) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  if (subject === "env-admin") {
    res.json({ sessions: [] });
    return;
  }

  const sessions = await sessionRepository.listSessionsByUser(subject);
  res.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent ?? null,
      ipAddress: s.ipAddress ?? null,
      createdAt: s.createdAt,
      lastActiveAt: s.lastActiveAt,
      revokedAt: s.revokedAt ?? null,
      current: currentSessionId ? s.id === currentSessionId : false,
    })),
  });
});

/**
 * DELETE /api/auth/sessions/:id
 */
export const logoutSession = asyncHandler(async (req: Request, res: Response) => {
  const payload = (req as any).user as any;
  const subject = payload?.sub as string | undefined;

  if (!subject) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  if (subject === "env-admin") {
    res.status(400).json({ error: "Session management is not supported for env-admin" });
    return;
  }

  const sessionId = String(req.params["id"] ?? "");
  if (!sessionId) {
    res.status(400).json({ error: "Session id is required" });
    return;
  }

  await sessionRepository.revokeSession(subject, sessionId);
  auditLog(req, "LOGOUT_SESSION", "AUTH", `Logged out session ${sessionId}`, {
    resourceId: sessionId,
    userId: subject,
    details: { sessionId },
  });
  res.json({ ok: true });
});

/**
 * GET /api/auth/me
 * Returns the authenticated user and (if linked) their staff member profile.
 */
export const me = asyncHandler(async (req: Request, res: Response) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    res.status(500).json({ error: "Internal server error" });
    return;
  }

  const payload = (req as any).user as any;
  const subject = payload?.sub as string | undefined;
  const staffId = payload?.staffId as string | undefined;

  // JWT subject comes from `jwt.sign(..., { subject })`
  if (!subject) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  if (subject === "env-admin") {
    const username = process.env.ADMIN_USERNAME || "admin";
    const staff = staffId ? await staffRepository.findById(staffId) : undefined;
    res.json({
      user: {
        id: "env-admin",
        username,
        role: "admin",
        staffId: staffId ?? undefined,
      },
      staff: staff ?? null,
    });
    return;
  }

  const user = await userService.getUserById(subject);
  if (!user) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const staff = user.staffId ? await staffRepository.findById(user.staffId) : undefined;

  res.json({
    user: userService.toPublicUser(user),
    staff: staff ?? null,
  });
});
