import { z } from "zod";

export const createActivityLogSchema = z.object({
  userId: z.string().uuid().optional(),
  action: z.string().min(1).max(100),
  resourceType: z.string().max(50).optional(),
  resourceId: z.string().uuid().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  ipAddress: z.string().max(64).optional(),
  userAgent: z.string().max(1024).optional(),
});
