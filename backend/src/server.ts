import dotenv from "dotenv";

// Load environment variables before any other imports resolve their env values
dotenv.config();

import http from "http";

import app from "./app";
import { initializeSocket } from "./realtime/socket";
import { initializeDatabase } from "./config/db";
import pool from "./config/db";
import { validateEnvironment } from "./config/env";

const PORT = Number(process.env.PORT) || 3000;

// Create a shared HTTP server for Express and Socket.IO
const server = http.createServer(app);

server.requestTimeout = 30_000;
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
initializeSocket(server);

// Start server
async function startServer() {
  try {
    validateEnvironment();
    await initializeDatabase();

    server.listen(PORT, () => {
      console.log(
        `🚀 Server running on http://localhost:${PORT}`
      );
    });
  } catch (err) {
    console.error(
      "Failed to initialize database:",
      err
    );

    process.exit(1);
  }
}

void startServer();

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}; shutting down`);

  server.close(async error => {
    if (error) {
      console.error("HTTP server shutdown failed:", error);
      process.exitCode = 1;
    }

    try {
      await pool.end();
    } catch (poolError) {
      console.error("Database pool shutdown failed:", poolError);
      process.exitCode = 1;
    }
  });
}

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

