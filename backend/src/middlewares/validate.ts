import { Request, Response, NextFunction } from "express";
import { z } from "zod";

/**
 * Factory returning an Express middleware that validates req.body
 * against the provided Zod schema.
 *
 * On failure: responds 400 with structured field-level error details.
 * On success: replaces req.body with the validated (and stripped) data.
 */
export function validate(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: "Validation failed",
        details: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    // Replace body with validated data — strips unknown/extra fields
    req.body = result.data;
    next();
  };
}
