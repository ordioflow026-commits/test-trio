import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Socket.io logic for WebRTC signaling
  const rooms: Record<string, string[]> = {};

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", (roomId: string) => {
      if (!rooms[roomId]) {
        rooms[roomId] = [];
      }
      rooms[roomId].push(socket.id);
      socket.join(roomId);
      
      // Notify others in the room
      const otherUsers = rooms[roomId].filter(id => id !== socket.id);
      socket.emit("all-users", otherUsers);
      
      console.log(`User ${socket.id} joined room ${roomId}`);
    });

    socket.on("sending-signal", (payload: { userToSignal: string, callerId: string, signal: any }) => {
      io.to(payload.userToSignal).emit("user-joined", { signal: payload.signal, callerId: payload.callerId });
    });

    socket.on("returning-signal", (payload: { signal: any, callerId: string }) => {
      io.to(payload.callerId).emit("receiving-returned-signal", { signal: payload.signal, id: socket.id });
    });

    socket.on("sync-screens", (payload: { roomId: string, screens: any[] }) => {
      socket.to(payload.roomId).emit("screens-updated", payload.screens);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      for (const roomId in rooms) {
        rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
        socket.to(roomId).emit("user-left", socket.id);
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
