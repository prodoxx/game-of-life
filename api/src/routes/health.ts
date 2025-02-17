import { Router, Request, Response } from "express";

const router: Router = Router();

router.get("/health-check", (_req: Request, res: Response) => {
  res.status(200).json({ message: "Ok" });
});

export default router;
