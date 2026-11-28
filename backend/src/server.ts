import dotenv from "dotenv";

// Load environment variables before any other imports resolve their env values
dotenv.config();

import http from "http";

import app from "./app";
import { initializeSocket } from "./realtime/socket";
import { initializeDatabase } from "./config/db";
import pool from "./config/db";
import { validateEnvironment } from "./config/env";
import { specialIssueUploadConfig } from "./config/special-issue-upload";
import { drainAuditLogs } from "./modules/activity-logs/activity-log.audit";
import { closeNotificationStreams } from "./modules/notifications/notification.service";
import { SupabasePrivatePdfStorage } from './storage/private-pdf-storage';
import { assertPrivatePdfAccessPolicy } from './storage/private-pdf-policy';
import { assertAuthVersionSchema } from './security/auth-version';
import { assertGoogleEmailSchema } from './security/google-email-schema';

const PORT = Number(process.env.PORT) || 3000;
const SHUTDOWN_DEADLINE_MS = 25_000;
let shuttingDown = false;

// Create a shared HTTP server for Express and Socket.IO
const server = http.createServer(app);

// Node's receive deadline must allow the bounded PDF upload window.
server.requestTimeout = specialIssueUploadConfig.receiveTimeoutMs;
server.headersTimeout = 15_000;
server.keepAliveTimeout = 5_000;
server.maxHeadersCount = 100;
server.maxRequestsPerSocket = 1_000;

server.on("clientError", (_error, socket) => {
  if (socket.writable) {
    socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    return;
  }

  socket.destroy();
});

// Initialize Socket.IO
const sockets = initializeSocket(server);

// Start server
async function startServer() {
  try {
    validateEnvironment();
    if (process.env.NODE_ENV === 'production') {
      await new SupabasePrivatePdfStorage().assertPrivate();
      await assertPrivatePdfAccessPolicy(pool);
    }
    await initializeDatabase();
    await assertAuthVersionSchema(pool);
    await assertGoogleEmailSchema(pool);

    if (shuttingDown) return;
    server.listen(PORT, () => {
      console.log(
        `🚀 Server running on http://localhost:${PORT}`
      );
    });
  } catch (err) {
    if (shuttingDown) return;
    console.error(
      "Failed to initialize database:",
      err
    );

    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down`);

  const deadline = setTimeout(() => {
    console.error("Server shutdown deadline exceeded");
    process.exit(1);
  }, SHUTDOWN_DEADLINE_MS);
  deadline.unref();

  try {
    try {
      closeNotificationStreams();
      // Socket.IO closes its transports and the attached HTTP server together.
      await sockets.close(error => {
        if (error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING") {
          console.error("HTTP server shutdown failed:", error);
          process.exitCode = 1;
        }
      });
    } finally {
      await drainAuditLogs().finally(() => pool.end());
    }
    clearTimeout(deadline);
  } catch (error) {
    console.error("Server shutdown failed:", error);
    process.exitCode = 1;
  }
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

void startServer();

