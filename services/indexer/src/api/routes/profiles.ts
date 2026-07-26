import { Router, Request, Response } from "express";
import { Database } from "../../db";
import { sendSuccess, sendError, sendNotFound } from "../response";

export function createProfilesRouter(db: Database): Router {
  const router = Router();

  router.get("/:address", async (req: Request, res: Response): Promise<void> => {
    const { address } = req.params;

    if (!address || typeof address !== "string" || address.trim() === "") {
      sendError(res, 400, "address is required", "INVALID_ADDRESS");
      return;
    }

    const profile = await db.getProfile(address);
    if (!profile) {
      sendNotFound(res, "Profile");
      return;
    }

    sendSuccess(res, profile);
  });

  return router;
}