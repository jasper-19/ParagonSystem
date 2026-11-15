import { z } from "zod";

export const activityLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  module: z.string().trim().max(50).optional(),
  action: z.string().trim().max(100).optional(),
  dateFrom: z.iso.date().optional(),
  search: z.string().trim().max(200).optional(),
});
