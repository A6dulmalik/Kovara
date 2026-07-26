import { Router, Request, Response } from "express";
import { Database } from "../../db";
import { sendSuccess, sendError, sendPaginated, sendNotFound } from "../response";

export function createPostsRouter(db: Database): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response): Promise<void> => {
    const author = typeof req.query.author === "string" ? req.query.author : undefined;
    const rawLimit = req.query.limit !== undefined ? Number(req.query.limit) : 20;
    const rawOffset = req.query.offset !== undefined ? Number(req.query.offset) : 0;

    if (!Number.isInteger(rawLimit) || rawLimit < 1) {
      sendError(res, 400, "limit must be a positive integer", "INVALID_QUERY");
      return;
    }
    if (rawLimit > 100) {
      sendError(res, 400, "limit cannot exceed 100", "LIMIT_EXCEEDED");
      return;
    }
    if (!Number.isInteger(rawOffset) || rawOffset < 0) {
      sendError(res, 400, "offset must be a non-negative integer", "INVALID_QUERY");
      return;
    }

    const { posts, total } = await db.listPosts({ author, limit: rawLimit, offset: rawOffset });
    sendPaginated(res, posts, total, rawLimit, rawOffset);
  });

  router.get("/:id", async (req: Request, res: Response): Promise<void> => {
    const rawId = req.params.id;
    let postId: bigint;
    try {
      postId = BigInt(rawId);
      if (postId < BigInt(0)) throw new Error();
    } catch {
      sendError(res, 400, "id must be a non-negative integer", "INVALID_ID");
      return;
    }

    const post = await db.getPost(postId);
    if (!post) {
      sendNotFound(res, "Post");
      return;
    }

    sendSuccess(res, post);
  });

  return router;
}