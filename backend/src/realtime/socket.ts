import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { getAllowedOrigins, isAllowedOrigin } from "../config/security";
import { getAuthToken, verifyAuthToken } from "../security/auth-token";
import * as sessionRepository from "../modules/auth/session.repository";
import { authorizeLiveAdmin } from "../security/live-session";

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
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      // Anonymous non-browser subscribers are public only; cookie credentials
      // require a trusted browser origin even for WebSocket upgrades.
      const allowed = origin ? isAllowedOrigin(origin) : !req.headers.cookie;
      callback(null, allowed);
    },
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
          payload.sid as string,
          payload,
          false
        ))
      ) {
        next(new Error("Unauthorized"));
        return;
      }

      socket.data["isAdmin"] = true;
      socket.data["authToken"] = authToken.token;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", socket => {
    if (socket.data["isAdmin"] === true) {
      void socket.join(ADMIN_SOCKET_ROOM);
      let checking = false;
      const timer = setInterval(async () => {
        if (checking) return;
        checking = true;
        try {
          if (!await authorizeLiveAdmin(socket.data["authToken"])) socket.disconnect(true);
        } finally { checking = false; }
      }, 25_000);
      timer.unref();
      socket.on("disconnect", () => clearInterval(timer));
    }
  });

  return io;
}

export async function emitPrivateAdminEvent(event: string, payload?: unknown): Promise<void> {
  if (!io) return;
  await Promise.all([...io.sockets.sockets.values()].map(async socket => {
    if (socket.data["isAdmin"] !== true) return;
    if (await authorizeLiveAdmin(socket.data["authToken"])) {
      if (socket.connected) socket.emit(event, payload);
    } else socket.disconnect(true);
  }));
}

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.IO has not been initialized.");
  }

  return io;
}
