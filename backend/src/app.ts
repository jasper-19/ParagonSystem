import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import routes from "./routes";
import { xssSanitize } from "./middlewares/sanitize";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();

// Secure HTTP response headers (XSS protection, clickjacking, etc.)
app.use(helmet());

// Restrict CORS to the Angular frontend origin only
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:4200",
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Limit JSON body size to 50 kb to prevent payload abuse
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: false, limit: "50kb" }));

// Sanitize req.body and req.query to strip XSS payloads
app.use(xssSanitize);

// General rate limit: 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api", apiLimiter);

// Mount all versioned API routes
app.use("/api", routes);

// Centralized error handler — must be the last middleware registered
app.use(errorHandler);

export default app;

