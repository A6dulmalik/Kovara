import { Router, Request, Response } from "express";
import { Database } from "../../db";
import { sendSuccess, sendError, sendNotFound } from "../response";

export function createPoolsRouter(db: Database): Router {
  const router = Router();

  router.get("/:id", async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id || typeof id !== "string" || id.trim() === "") {
      sendError(res, 400, "id is required", "INVALID_ID");
      return;
    }

    const pool = await db.getPool(id);
    if (!pool) {
      sendNotFound(res, "Pool");
      return;
    }

    sendSuccess(res, pool);
  });

  return router;
}