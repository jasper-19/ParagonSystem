import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import routes from "./routes";
import pool from "./config/db";
import path from "path";
import { errorHandler } from "./middlewares/errorHandler";
import { performance } from "node:perf_hooks";
import { getAllowedOrigins } from "./config/security";
import { csrfProtection } from "./middlewares/csrf";
import { enforceMaintenanceMode } from "./middlewares/maintenance";
import { pdfConfig } from "./config/pdf";
import { pdfProcessor } from "./modules/special-issues/pdf-processing/ghostscript-pdf.processor";

const app = express();
const isProduction = process.env.NODE_ENV === "production";

app.set("etag", "strong"); // Enable strong ETag headers for caching
app.disable("x-powered-by");
app.set(
  "trust proxy",
  isProduction
    ? Math.max(1, Number(process.env.TRUST_PROXY_HOPS) || 1)
    : false
);

app.use((req, res, next) => {
  if (req.method === "TRACE" || req.method === "CONNECT") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  next();
});

// Secure HTTP response headers (XSS protection, clickjacking, etc.)
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

// Restrict CORS to the Angular frontend origin only
const allowedOrigins = getAllowedOrigins();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-CSRF-Protection",
    ],
    exposedHeaders: ["X-Page", "X-Page-Size", "X-Has-More"],
    credentials: true,
    maxAge: 600,
  })
);

// Increase JSON body size to allow image/PDF uploads as base64 (short-term fix).
// Consider switching to multipart uploads for files + smaller JSON payloads.
// NOTE: base64 increases payload size by ~33% over the original file size.
const configuredBodyLimitMb = Number(
  process.env.REQUEST_BODY_LIMIT_MB || "5"
);
const requestBodyLimitMb = Number.isFinite(configuredBodyLimitMb)
  ? Math.min(Math.max(configuredBodyLimitMb, 1), 20)
  : 5;
const requestBodyLimit = `${requestBodyLimitMb}mb`;
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: false, limit: requestBodyLimit }));

app.use("/api", csrfProtection);

// General API rate limit per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api", apiLimiter);
app.use("/api", enforceMaintenanceMode);

// Health check endpoint for load balancers and uptime monitoring
app.get("/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true });
});

app.get("/ready", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const [, pdfAvailable] = await Promise.all([
      pool.query("SELECT 1"),
      pdfConfig.enabled
        ? pdfProcessor.checkAvailability()
        : Promise.resolve(false),
    ]);

    if (pdfConfig.requiredForReadiness && !pdfAvailable) {
      res.status(503).json({
        ready: false,
        dependencies: {
          database: true,
          pdfProcessor: false,
        },
      });
      return;
    }

    res.status(200).json({
      ready: true,
      dependencies: {
        database: true,
        pdfProcessor: pdfAvailable,
      },
    });
  } catch (error) {
    console.error("Readiness check failed:", error);

    res.status(503).json({
      ready: false,
    });
  }
});

if (process.env.NODE_ENV !== "production") {
  // Serve uploaded files from the local "uploads" directory in development
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
}

export async function initializeDatabase(): Promise<void> {
  const startedAt = performance.now();

  const clients = await Promise.all([
    pool.connect(),
    pool.connect(),
    pool.connect(),
    pool.connect(),
  ]);

  try {
    await Promise.all(
      clients.map(client =>
        client.query("SELECT 1")
      )
    );
  } finally {
    clients.forEach(client =>
      client.release()
    );
  }

  console.log(
    `[DB] Pool warmed in ${(
      performance.now() - startedAt
    ).toFixed(2)}ms`
  );
}

// Mount all versioned API routes
app.use("/api", routes);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Centralized error handler — must be the last middleware registered
app.use(errorHandler);

export default app;

