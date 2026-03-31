import { z } from "zod";

export const MEDIA_TYPE_VALUES = ["image", "video", "document", "audio"] as const;
export type MediaType = (typeof MEDIA_TYPE_VALUES)[number];

export const updateMediaSchema = z.object({
  altText: z.string().max(1000).optional(),
  caption: z.string().max(2000).optional(),
  tags: z.array(z.string().min(1).max(100)).max(50).optional(),
});

