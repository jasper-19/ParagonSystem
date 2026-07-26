import { z } from "zod";

const uuid = z.string().uuid("Invalid identifier");

export const idParamSchema = z.object({ id: uuid });
export const applicationIdParamSchema = z.object({ applicationId: uuid });
export const boardIdParamSchema = z.object({ boardId: uuid });
export const boardMemberParamsSchema = z.object({
  boardId: uuid,
  memberId: uuid,
});
export const sessionIdParamSchema = z.object({ id: uuid });
