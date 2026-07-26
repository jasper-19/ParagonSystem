import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { getAllowedOrigins } from "../config/security";
import { getAuthToken, verifyAuthToken } from "../security/auth-token";
import * as sessionRepository from "../modules/auth/session.repository";

let io: Server;

export const ADMIN_SOCKET_ROOM = "authenticated-admins";

export function initializeSocket(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
      methods: ["GET", "POST"],
    },
    maxHttpBufferSize: 64 * 1024,
    perMessageDeflate: false,
  });

  io.use(async (socket, next) => {
    try {
      const authToken = getAuthToken(socket.request);
      if (!authToken) {
        next();
        return;
      }

      const payload = verifyAuthToken(authToken.token);
      if (payload.role !== "admin") {
        next();
        return;
      }

      if (
        payload.sub !== "env-admin" &&
        !(await sessionRepository.validateAndTouchSession(
          payload.sub,
          payload.sid as string
        ))
      ) {
        next(new Error("Unauthorized"));
        return;
      }

      socket.data["isAdmin"] = true;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", socket => {
    if (socket.data["isAdmin"] === true) {
      void socket.join(ADMIN_SOCKET_ROOM);
    }
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.IO has not been initialized.");
  }

  return io;
}
