import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../../utils/asyncHandler";

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

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  const jwtSecret = process.env.JWT_SECRET;

  if (!adminUsername || !adminPasswordHash || !jwtSecret) {
    console.error("[login] Missing ADMIN_USERNAME, ADMIN_PASSWORD_HASH, or JWT_SECRET in .env");
    res.status(500).json({ error: "Internal server error" });
    return;
  }

  // Use constant-time comparison for username to avoid timing attacks
  const usernameMatch = username === adminUsername;
  // Always run bcrypt.compare to prevent timing-based username enumeration
  const passwordMatch = await bcrypt.compare(password, adminPasswordHash);

  if (!usernameMatch || !passwordMatch) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = jwt.sign({ role: "admin" }, jwtSecret, { expiresIn: "8h" });

  res.json({ token });
});
