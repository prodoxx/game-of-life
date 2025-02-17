import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";

export const configureMiddleware = (app: express.Application) => {
  // cors configuration
  app.use(
    cors({
      origin: process.env.APP_BASE_URL,
      credentials: true,
    }),
  );

  // helmet handles a lot of security related  issues
  app.use(helmet());

  // rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // limit each IP to 100 requests per windowMs
  });
  app.use(limiter);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
};
