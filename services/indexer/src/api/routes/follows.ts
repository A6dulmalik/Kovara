import { Router, Request, Response } from "express";
import { Database } from "../../db";
import { sendSuccess, sendError, sendPaginated } from "../response";

export function createFollowsRouter(db: Database): Router {
  const router = Router();

  function parsePagination(
    query: Record<string, unknown>
  ): { limit: number; offset: number } | null {
    const rawLimit = query.limit !== undefined ? Number(query.limit) : 20;
    const rawOffset = query.offset !== undefined ? Number(query.offset) : 0;

    if (!Number.isInteger(rawLimit) || rawLimit < 1) return null;
    if (rawLimit > 100) return null;
    if (!Number.isInteger(rawOffset) || rawOffset < 0) return null;

    return { limit: rawLimit, offset: rawOffset };
  }

  router.get("/:address/followers", async (req: Request, res: Response): Promise<void> => {
    const { address } = req.params;
    const pagination = parsePagination(req.query as Record<string, unknown>);

    if (!pagination) {
      sendError(res, 400, "Invalid pagination parameters", "INVALID_QUERY");
      return;
    }

    const { limit, offset } = pagination;
    const { followers, total } = await db.getFollowers(address, limit, offset);
    sendPaginated(res, followers, total, limit, offset);
  });

  router.get("/:address/following", async (req: Request, res: Response): Promise<void> => {
    const { address } = req.params;
    const pagination = parsePagination(req.query as Record<string, unknown>);

    if (!pagination) {
      sendError(res, 400, "Invalid pagination parameters", "INVALID_QUERY");
      return;
    }

    const { limit, offset } = pagination;
    const { following, total } = await db.getFollowing(address, limit, offset);
    sendPaginated(res, following, total, limit, offset);
  });

  return router;
}