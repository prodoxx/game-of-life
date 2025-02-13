import express from "express";
import { createServer } from "http";
import { configureMiddleware } from "./config/middleware";
import { healthRoutes } from "./routes";

const app = express();
const server = createServer(app);

// configure middleware
configureMiddleware(app);

// api routes
app.use("/v1", healthRoutes);

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
