import express from "express";
import path from "node:path";

/** Development delivery mirrors immutable object-storage PDF semantics. */
export function localUploadsMiddleware(root = path.join(process.cwd(), "uploads")) {
  const router = express.Router();
  router.use((req, res, next) => {
    // Even accidental copies of private files inside uploads cannot bypass API authorization.
    let decodedPath: string;
    try { decodedPath = decodeURIComponent(req.path); } catch { res.status(404).end(); return; }
    const parts = decodedPath.toLowerCase().split(/[/\\]/);
    if (parts.includes('private-special-issues')) { res.status(404).end(); return; }
    next();
  });
  router.use(express.static(root, {
    dotfiles: "deny",
    acceptRanges: true,
    etag: true,
    setHeaders(res, filePath) {
      if (/[/\\]special-issues[/\\][a-f0-9-]+[/\\][a-f0-9-]+\.pdf$/i.test(filePath)) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }));
  return router;
}
