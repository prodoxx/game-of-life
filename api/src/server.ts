// load env variables in production environments
if (process.env.NODE_ENV !== "production") {
  const { config } = await import("dotenv");
  config();
}

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { configureMiddleware } from "./config/middleware";
import { healthRoutes, roomsRoutes } from "./routes";
import { GameEventsService } from "./services/gameEvents";

const app = express();
const server = createServer(app);
export const io = new Server(server, {
  cors: {
    origin: process.env.APP_BASE_URL ?? "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// configure middleware
configureMiddleware(app);

// api routes
app.use("/v1", healthRoutes);
app.use("/v1", roomsRoutes);

// initialize socket services
const gameEventsService = new GameEventsService(io);
io.on("connection", (socket) => {
  gameEventsService.handleConnection(socket);
});

const PORT = process.env.PORT || 3000;

const gracefulShutdown = () => {
  console.log("Received shutdown signal. Starting graceful shutdown...");

  server.close(() => {
    console.log("Server closed. Exiting process.");
    process.exit(0);
  });

  // force close after 10s
  setTimeout(() => {
    console.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000);
};

// handle shutdown signals
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
