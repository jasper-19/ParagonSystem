import express from "express";
import path from "node:path";

/** Development delivery mirrors immutable object-storage PDF semantics. */
export function localUploadsMiddleware(root = path.join(process.cwd(), "uploads")) {
  return express.static(root, {
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
  });
}
