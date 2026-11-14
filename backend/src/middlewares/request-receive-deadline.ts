import type { Request, RequestHandler, Response } from "express";

export function sendReceiveTimeout(req: Request, res: Response, message: string): void {
  const interrupt = (): void => { req.destroy(new Error("Request receive timeout")); };
  if (res.headersSent || res.destroyed) { interrupt(); return; }
  // Flush the useful 408 before closing its socket; still bound a slow reader.
  const forceClose = setTimeout(interrupt, 1_000);
  forceClose.unref();
  req.once("close", () => { clearTimeout(forceClose); });
  res.once("finish", interrupt);
  res.status(408).json({ error: message });
}

/** Preserve the existing 30s body deadline for requests outside PDF uploads. */
export const requestReceiveDeadline: RequestHandler = (req, res, next) => {
  const isPdfUpload = Boolean(req.is("multipart/form-data")) && (
    req.method === "POST" && /^\/api\/special-issues\/?$/.test(req.path) ||
    req.method === "PATCH" && /^\/api\/special-issues\/[^/]+\/pdf\/?$/.test(req.path)
  );
  if (isPdfUpload || req.complete) { next(); return; }
  const clear = (): void => {
    clearTimeout(timer);
    req.removeListener("end", clear);
    req.removeListener("close", clear);
    res.removeListener("finish", clear);
  };
  const timer = setTimeout(() => {
    clear();
    sendReceiveTimeout(req, res, "Request body timed out");
  }, 30_000);
  timer.unref();
  req.once("end", clear);
  req.once("close", clear);
  res.once("finish", clear);
  next();
};
