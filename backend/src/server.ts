import dotenv from "dotenv";

// Load environment variables before any other imports resolve their env values
dotenv.config();

import http from "http";

import app from "./app";
import { initializeSocket } from "./realtime/socket";
import { initializeDatabase } from "./config/db";

const PORT = Number(process.env.PORT) || 3000;

// Create a shared HTTP server for Express and Socket.IO
const server = http.createServer(app);

// Initialize Socket.IO
initializeSocket(server);

// Start server
async function startServer() {
  try {
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

