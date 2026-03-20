import { Request, Response, NextFunction } from "express";

/**
 * Ensures the authenticated user has role=admin.
 * Assumes `authenticate` middleware already ran and set req.user.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user as any;
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
}

