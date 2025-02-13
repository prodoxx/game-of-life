import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

export const configureMiddleware = (app: express.Application) => {
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
